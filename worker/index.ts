export interface Env { DB: D1Database; ADMIN_TOKEN?: string; ALLOWED_ORIGIN?: string; ASSETS: Fetcher; }
type Config = { upiId:string; beneficiary:string; instructions:string; enabled:boolean; version:number; updatedAt:string };
const DEFAULT: Config = { upiId:"", beneficiary:"", instructions:"Use the payment details shown here and keep your transaction reference for your records.", enabled:false, version:0, updatedAt:"" };
const headers=(origin:string,env:Env)=>{const h:Record<string,string>={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Vary":"Origin"};if(origin&&origin===env.ALLOWED_ORIGIN)h["Access-Control-Allow-Origin"]=env.ALLOWED_ORIGIN!;return h;};
function json(data:unknown,status:number,origin:string,env:Env){return new Response(JSON.stringify(data),{status,headers:headers(origin,env)});}
function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function mapRow(row:any):Config{return {upiId:row.receiving_upi_id||"",beneficiary:row.beneficiary_display_name||"",instructions:row.instructions||DEFAULT.instructions,enabled:!!row.enabled,version:Number(row.version||0),updatedAt:row.updated_at||""};}
async function readConfig(env:Env){const row=await env.DB.prepare("SELECT * FROM payment_config WHERE id='primary'").first<any>();return row?mapRow(row):DEFAULT;}
async function ensureRow(env:Env){await env.DB.prepare("INSERT OR IGNORE INTO payment_config (id,enabled,receiving_upi_id,beneficiary_display_name,instructions,qr_mode,version) VALUES ('primary',0,'','','','generated',0)").run();}
export default { async fetch(req:Request,env:Env){
 const url=new URL(req.url), origin=req.headers.get("Origin")||"", allowed=env.ALLOWED_ORIGIN||"";
 const api=url.pathname.startsWith("/api/");
 if(api&&origin&&origin!==allowed)return json({error:"Origin not allowed"},403,origin,env);
 if(req.method==="OPTIONS"&&api){if(origin&&origin!==allowed)return new Response(null,{status:403});return new Response(null,{status:204,headers:{...headers(origin,env),"Access-Control-Allow-Methods":"GET, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Max-Age":"600"}});}
 if(url.pathname!=="/api/payment-config")return env.ASSETS.fetch(req);
 if(req.method==="GET"){try{return json(await readConfig(env),200,origin,env)}catch{return json({error:"Configuration unavailable"},500,origin,env)}}
 if(req.method!=="PUT")return json({error:"Method not allowed"},405,origin,env);
 const auth=req.headers.get("Authorization")||"";
 if(!env.ADMIN_TOKEN||!auth.startsWith("Bearer ")||!constantTimeEqual(auth.slice(7),env.ADMIN_TOKEN))return json({error:"Unauthorized"},401,origin,env);
 if(Number(req.headers.get("Content-Length")||0)>8192)return json({error:"Request too large"},413,origin,env);
 let body:any;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400,origin,env)}
 if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Invalid request body"},400,origin,env);
 const upiId=String(body.upiId||"").trim(), beneficiary=String(body.beneficiary||"").trim().slice(0,200), instructions=String(body.instructions||"").trim().slice(0,1000), enabled=body.enabled===true;
 const valid=/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upiId);
 if(enabled&&(!valid||!beneficiary))return json({error:"A valid UPI ID and payee name are required to enable collection"},400,origin,env);
 if(upiId&&!valid)return json({error:"Invalid UPI ID format"},400,origin,env);
 try{await ensureRow(env);const before=await readConfig(env);await env.DB.prepare("UPDATE payment_config SET enabled=?,receiving_upi_id=?,beneficiary_display_name=?,instructions=?,qr_mode='generated',version=version+1,updated_at=CURRENT_TIMESTAMP,updated_by='admin-api' WHERE id='primary'").bind(enabled?1:0,upiId,beneficiary,instructions).run();const after=await readConfig(env);await env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target,before_snapshot,after_snapshot) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),"admin-api","payment_config.updated","payment_config:primary",JSON.stringify(before),JSON.stringify(after)).run();return json(after,200,origin,env)}catch{return json({error:"Could not save configuration"},500,origin,env)}
 },};
