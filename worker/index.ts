export interface Env { DB: D1Database; ADMIN_TOKEN?: string; ALLOWED_ORIGIN?: string; ASSETS: Fetcher; }
type Config = { upiId:string; beneficiary:string; instructions:string; enabled:boolean; version:number; updatedAt:string };
const DEFAULT: Config = { upiId:"", beneficiary:"", instructions:"Use the payment details shown here and keep your transaction reference for your records.", enabled:false, version:0, updatedAt:"" };
const SECURITY_HEADERS:Record<string,string>={
 "Cache-Control":"no-store, max-age=0",
 "Pragma":"no-cache",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
 "X-Frame-Options":"DENY",
 "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
 "Strict-Transport-Security":"max-age=31536000; includeSubDomains",
 "Content-Security-Policy":"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';"
};
function headers(origin:string,env:Env){const h:Record<string,string>={"Content-Type":"application/json; charset=utf-8",...SECURITY_HEADERS,"Vary":"Origin"};if(origin&&origin===env.ALLOWED_ORIGIN)h["Access-Control-Allow-Origin"]=env.ALLOWED_ORIGIN!;return h;}
function json(data:unknown,status:number,origin:string,env:Env){return new Response(JSON.stringify(data),{status,headers:headers(origin,env)});}
function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function mapRow(row:any):Config{return {upiId:row.receiving_upi_id||"",beneficiary:row.beneficiary_display_name||"",instructions:row.instructions||DEFAULT.instructions,enabled:!!row.enabled,version:Number(row.version||0),updatedAt:row.updated_at||""};}
async function readConfig(env:Env){const row=await env.DB.prepare("SELECT * FROM payment_config WHERE id='primary'").first<any>();return row?mapRow(row):DEFAULT;}
async function ensureRow(env:Env){await env.DB.prepare("INSERT OR IGNORE INTO payment_config (id,enabled,receiving_upi_id,beneficiary_display_name,instructions,qr_mode,version) VALUES ('primary',0,'','','','generated',0)").run();}
function publicConfig(config:Config){return {upiId:config.upiId,beneficiary:config.beneficiary,instructions:config.instructions,enabled:config.enabled};}
async function rateLimitAdminWrite(req:Request,env:Env){
 const ip=req.headers.get("CF-Connecting-IP")||"unknown";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
 const ipHash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
 const window=Math.floor(Date.now()/600000), key=ipHash+":"+window;
 const result=await env.DB.prepare("INSERT INTO rate_limit_buckets(bucket_key,hits,window_started) VALUES(?,1,CURRENT_TIMESTAMP) ON CONFLICT(bucket_key) DO UPDATE SET hits=hits+1 RETURNING hits").bind(key).first<{hits:number}>();
 if(!result)throw new Error("Rate limiter unavailable");
 if(result.hits>20)return false;
 if(window%6===0)await env.DB.prepare("DELETE FROM rate_limit_buckets WHERE window_started < datetime('now','-2 hours')").run();
 return true;
}
function corsHeaders(origin:string,env:Env){return {...headers(origin,env),"Access-Control-Allow-Methods":"GET, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Max-Age":"600"};}
export default { async fetch(req:Request,env:Env){
 const url=new URL(req.url), origin=req.headers.get("Origin")||"", allowed=env.ALLOWED_ORIGIN||"", isApi=url.pathname.startsWith("/api/");
 if(isApi&&origin&&origin!==allowed)return json({error:"Origin not allowed"},403,origin,env);
 if(req.method==="OPTIONS"&&isApi){if(origin&&origin!==allowed)return new Response(null,{status:403,headers:SECURITY_HEADERS});return new Response(null,{status:204,headers:corsHeaders(origin,env)});}
 if(isApi&&url.pathname!=="/api/payment-config"&&url.pathname!=="/api/payment-proofs")return json({error:"Not found"},404,origin,env);
 if(url.pathname==="/api/payment-proofs"){
  if(req.method==="POST"){
   let allowedRate:boolean;try{allowedRate=await rateLimitAdminWrite(req,env)}catch{return json({error:"Submission security service unavailable. Please retry."},503,origin,env)}
   if(!allowedRate)return json({error:"Too many submissions. Please wait and try again."},429,origin,env);
   let raw:string;try{raw=await req.text()}catch{return json({error:"Could not read submission. Please retry."},400,origin,env)}
   if(new TextEncoder().encode(raw).length>1600000)return json({error:"Proof file is too large. Maximum upload size is 1 MB."},413,origin,env);
   let body:any;try{body=JSON.parse(raw)}catch{return json({error:"Invalid submission data."},400,origin,env)}
   const amount=Number(body?.amount), utr=String(body?.utr||"").trim().toUpperCase(), payerName=String(body?.payerName||"").trim().slice(0,120), payerEmail=String(body?.payerEmail||"").trim().slice(0,200), note=String(body?.note||"").trim().slice(0,300), mime=String(body?.proofMime||""), proof=String(body?.proofBase64||"");
   if(!Number.isFinite(amount)||amount<=0||amount>99999999)return json({error:"Enter a valid payment amount."},400,origin,env);
   if(!/^[A-Z0-9]{8,30}$/.test(utr))return json({error:"Enter a valid UTR or transaction reference (8–30 letters/numbers)."},400,origin,env);
   if(!payerName)return json({error:"Enter the name used for the payment."},400,origin,env);
   if(payerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail))return json({error:"Enter a valid email address."},400,origin,env);
   if(!["image/jpeg","image/png","application/pdf"].includes(mime))return json({error:"Proof must be JPG, PNG, or PDF."},400,origin,env);
   if(!proof||proof.length>1400000||!/^[A-Za-z0-9+/]+={0,2}$/.test(proof))return json({error:"Choose a valid proof file under 1 MB."},400,origin,env);
   const id=crypto.randomUUID();
   try{await env.DB.prepare("INSERT INTO payment_proof_submissions(id,amount_minor,utr,payer_name,payer_email,note,proof_mime,proof_base64) VALUES(?,?,?,?,?,?,?,?)").bind(id,Math.round(amount*100),utr,payerName,payerEmail,note,mime,proof).run();return json({success:true,id,status:"pending",message:"Proof submitted for review. Your balance will not change until payment is verified."},201,origin,env)}catch(e:any){if(String(e?.message||"").includes("UNIQUE"))return json({error:"This UTR has already been submitted."},409,origin,env);return json({error:"Submission could not be saved. Please try again."},500,origin,env)}
  }
  if(req.method==="GET"){
   const auth=req.headers.get("Authorization")||"";
   if(!env.ADMIN_TOKEN||!auth.startsWith("Bearer ")||!constantTimeEqual(auth.slice(7),env.ADMIN_TOKEN))return json({error:"Unauthorized"},401,origin,env);
   try{const rows=await env.DB.prepare("SELECT id,amount_minor,utr,payer_name,payer_email,note,proof_mime,status,submitted_at FROM payment_proof_submissions ORDER BY submitted_at DESC LIMIT 100").all();return json({submissions:rows.results||[]},200,origin,env)}catch{return json({error:"Could not load submissions"},500,origin,env)}
  }
  return json({error:"Method not allowed"},405,origin,env);
 }
 if(url.pathname==="/api/payment-config"){
  if(req.method==="GET"){try{return json(publicConfig(await readConfig(env)),200,origin,env)}catch{return json({error:"Configuration unavailable"},500,origin,env)}}
  if(req.method!=="PUT")return json({error:"Method not allowed"},405,origin,env);
  let rateAllowed:boolean;try{rateAllowed=await rateLimitAdminWrite(req,env)}catch{return json({error:"Security service unavailable; try again later"},503,origin,env)}
  if(!rateAllowed)return json({error:"Too many attempts. Try again later."},429,origin,env);
  const auth=req.headers.get("Authorization")||"";
  if(!env.ADMIN_TOKEN||!auth.startsWith("Bearer ")||!constantTimeEqual(auth.slice(7),env.ADMIN_TOKEN))return json({error:"Unauthorized"},401,origin,env);
  let raw:string;try{raw=await req.text()}catch{return json({error:"Invalid request"},400,origin,env)}
  if(new TextEncoder().encode(raw).length>8192)return json({error:"Request too large"},413,origin,env);
  let body:any;try{body=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400,origin,env)}
  if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Invalid request body"},400,origin,env);
  if(typeof body.enabled!=="boolean"||typeof body.upiId!=="string"||typeof body.beneficiary!=="string"||typeof body.instructions!=="string")return json({error:"Invalid field types"},400,origin,env);
  const upiId=body.upiId.trim(), beneficiary=body.beneficiary.trim().slice(0,200), instructions=body.instructions.trim().slice(0,1000), enabled=body.enabled;
  const valid=/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upiId);
  if(enabled&&(!valid||!beneficiary))return json({error:"A valid UPI ID and payee name are required to enable collection"},400,origin,env);
  if(upiId&&!valid)return json({error:"Invalid UPI ID format"},400,origin,env);
  try{await ensureRow(env);const before=await readConfig(env);const afterSnapshot:Config={upiId,beneficiary,instructions,enabled,version:before.version+1,updatedAt:"pending-db-timestamp"};const auditId=crypto.randomUUID();await env.DB.batch([env.DB.prepare("UPDATE payment_config SET enabled=?,receiving_upi_id=?,beneficiary_display_name=?,instructions=?,qr_mode='generated',version=version+1,updated_at=CURRENT_TIMESTAMP,updated_by='admin-api' WHERE id='primary'").bind(enabled?1:0,upiId,beneficiary,instructions),env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target,before_snapshot,after_snapshot) VALUES(?,?,?,?,?,?)").bind(auditId,"admin-api","payment_config.updated","payment_config:primary",JSON.stringify(before),JSON.stringify(afterSnapshot))]);const after=await readConfig(env);return json(after,200,origin,env)}catch{return json({error:"Could not save configuration"},500,origin,env)}
 }
 const response=await env.ASSETS.fetch(req);
 const secured=new Headers(response.headers);for(const [key,value] of Object.entries(SECURITY_HEADERS))secured.set(key,value);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:secured});
 },};
