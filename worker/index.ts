export interface Env {
 DB: D1Database; ASSETS: Fetcher; ALLOWED_ORIGIN?: string;
 ADMIN_TOKEN?: string; // legacy; disabled when Access auth is configured
 CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string; ADMIN_EMAILS?: string;
 CASHFREE_CLIENT_ID?: string; CASHFREE_CLIENT_SECRET?: string; CASHFREE_WEBHOOK_SECRET?: string;
 CASHFREE_ENV?: string; PAYMENTS_ENABLED?: string; PUBLIC_BASE_URL?: string;
}
type Config={upiId:string;beneficiary:string;instructions:string;enabled:boolean;version:number;updatedAt:string};
const DEFAULT:Config={upiId:"",beneficiary:"",instructions:"Use the payment details shown here and keep your transaction reference for your records.",enabled:false,version:0,updatedAt:""};
const SECURITY_HEADERS:Record<string,string>={"Cache-Control":"no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Strict-Transport-Security":"max-age=31536000; includeSubDomains","Content-Security-Policy":"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://sdk.cashfree.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://sandbox.cashfree.com https://api.cashfree.com; frame-src https://payments.cashfree.com https://sandbox.cashfree.com;"};
const enc=new TextEncoder();
function response(data:unknown,status=200,origin="",env?:Env,extra:Record<string,string>={}){const h=new Headers({"Content-Type":"application/json; charset=utf-8",...SECURITY_HEADERS,...extra});if(env&&origin&&origin===env.ALLOWED_ORIGIN)h.set("Access-Control-Allow-Origin",origin);h.set("Vary","Origin");return new Response(JSON.stringify(data),{status,headers:h});}
function cors(origin:string,env:Env){return {"Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization,CF-Access-Jwt-Assertion","Access-Control-Max-Age":"600",...(origin&&origin===env.ALLOWED_ORIGIN?{"Access-Control-Allow-Origin":origin}:{})};}
function b64uDecode(s:string){const p=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(p.padEnd(Math.ceil(p.length/4)*4,"=")),c=>c.charCodeAt(0));}
function b64(bytes:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(bytes)));}
async function sha256(s:string){return b64(await crypto.subtle.digest("SHA-256",enc.encode(s)));}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function accessIdentity(req:Request,env:Env):Promise<{email:string}|null>{
 const jwt=req.headers.get("CF-Access-Jwt-Assertion");if(!jwt||!env.CF_ACCESS_TEAM_DOMAIN||!env.CF_ACCESS_AUD)return null;
 const parts=jwt.split(".");if(parts.length!==3)return null;
 try{
  const header=JSON.parse(new TextDecoder().decode(b64uDecode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(b64uDecode(parts[1])));
  const issuer="https://"+env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(header.alg!=="RS256"||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(env.CF_ACCESS_AUD)||!claims.exp||claims.exp<=Date.now()/1000||claims.nbf&&claims.nbf>Date.now()/1000)return null;
  const jwks=await fetch(issuer+"/cdn-cgi/access/certs",{headers:{Accept:"application/json"},cf:{cacheTtl:300} as any});if(!jwks.ok)return null;
  const keys=(await jwks.json() as any).keys as JsonWebKey[];const jwk=keys.find(k=>(k as any).kid===header.kid);if(!jwk)return null;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64uDecode(parts[2]),enc.encode(parts[0]+"."+parts[1]));if(!valid)return null;
  const email=String(claims.email||"").toLowerCase();const allowed=(env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);if(!email||!allowed.includes(email))return null;return {email};
 }catch{return null}
}
async function requireAdmin(req:Request,env:Env){return await accessIdentity(req,env);}
function configRow(r:any):Config{return {upiId:r?.receiving_upi_id||"",beneficiary:r?.beneficiary_display_name||"",instructions:r?.instructions||DEFAULT.instructions,enabled:!!r?.enabled,version:Number(r?.version||0),updatedAt:r?.updated_at||""};}
async function getConfig(env:Env){const r=await env.DB.prepare("SELECT * FROM payment_config WHERE id='primary'").first<any>();return configRow(r);}
async function rateLimit(req:Request,env:Env,scope:string,limit=30){const ip=req.headers.get("CF-Connecting-IP")||"unknown";const digest=await crypto.subtle.digest("SHA-256",enc.encode(ip));const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");const bucket=Math.floor(Date.now()/60000);const key=scope+":"+hash+":"+bucket;const r=await env.DB.prepare("INSERT INTO rate_limit_buckets(bucket_key,hits,window_started) VALUES(?,1,CURRENT_TIMESTAMP) ON CONFLICT(bucket_key) DO UPDATE SET hits=hits+1 RETURNING hits").bind(key).first<{hits:number}>();if(bucket%60===0)await env.DB.prepare("DELETE FROM rate_limit_buckets WHERE window_started < datetime('now','-24 hours')").run();return !!r&&r.hits<=limit;}
function cashfreeBase(env:Env){return env.CASHFREE_ENV==="production"?"https://api.cashfree.com/pg":"https://sandbox.cashfree.com/pg";}
function cashfreeHeaders(env:Env){return {"x-client-id":env.CASHFREE_CLIENT_ID||"","x-client-secret":env.CASHFREE_CLIENT_SECRET||"","x-api-version":"2025-01-01","Content-Type":"application/json","Accept":"application/json"};}
function minor(amount:number){return Math.round(amount*100);}
function validAmount(v:any){return typeof v==="number"&&Number.isFinite(v)&&v>=1&&v<=1000000&&Math.round(v*100)===v*100;}
async function createOrder(req:Request,env:Env,origin:string){
 if(env.PAYMENTS_ENABLED!=="true")return response({error:"Payment initiation is disabled. Sandbox setup is incomplete."},503,origin,env);
 if(env.CASHFREE_ENV==="production")return response({error:"Production payments are blocked in this build."},403,origin,env);
 if(!env.CASHFREE_CLIENT_ID||!env.CASHFREE_CLIENT_SECRET)return response({error:"Sandbox credentials not configured"},503,origin,env);
 if(!(await rateLimit(req,env,"orders",10)))return response({error:"Rate limit exceeded"},429,origin,env);
 let body:any;try{body=await req.json()}catch{return response({error:"Invalid JSON"},400,origin,env);}
 if(!body||!validAmount(body.amount)||typeof body.purpose!=="string"||!body.purpose.trim()||body.purpose.length>100)return response({error:"Amount must be ₹1–₹10,00,000 and purpose is required"},400,origin,env);
 const orderId="xp_"+crypto.randomUUID().replace(/-/g,"").slice(0,28),accessToken=b64(await crypto.getRandomValues(new Uint8Array(32))),accessHash=await sha256(accessToken),cfg=await getConfig(env);
 const payload={order_id:orderId,order_amount:body.amount,order_currency:"INR",customer_details:{customer_id:"cust_"+orderId,customer_name:String(body.name||"Customer").slice(0,100),customer_email:String(body.email||"customer@example.com").slice(0,120),customer_phone:String(body.phone||"9999999999").replace(/[^0-9]/g,"").slice(-10)||"9999999999"},order_meta:{return_url:(env.PUBLIC_BASE_URL||"https://xinpay.nabinchettri0007.workers.dev")+"/payment-result?order_id="+orderId}};
 let cf:any;try{const r=await fetch(cashfreeBase(env)+"/orders",{method:"POST",headers:cashfreeHeaders(env),body:JSON.stringify(payload)});cf=await r.json();if(!r.ok)return response({error:"Payment provider rejected order",detail:cf?.message||cf?.type||"Provider error"},502,origin,env);}catch{return response({error:"Payment provider unavailable"},502,origin,env);}
 const expires=new Date(Date.now()+15*60*1000).toISOString();
 await env.DB.prepare("INSERT INTO payment_orders(id,provider,provider_order_id,purpose,amount_minor,currency,status,payment_session_id,payment_link,customer_access_hash,destination_config_version,destination_snapshot,expires_at) VALUES(?,?,?,?,?,'INR','pending',?,?,?,?,?,?)").bind(orderId,"cashfree",cf.order_id,body.purpose.trim().slice(0,100),minor(body.amount),cf.payment_session_id||null,cf.payment_link||null,accessHash,cfg.version,JSON.stringify({upiId:cfg.upiId,beneficiary:cfg.beneficiary}),expires).run();
 return response({orderId,orderToken:accessToken,status:"pending",amount:body.amount,currency:"INR",checkoutUrl:cf.payment_link||null,paymentSessionId:cf.payment_session_id||null,expiresAt:expires},201,origin,env);
}
async function getOrder(req:Request,env:Env,id:string,origin:string){const token=req.headers.get("Authorization")?.replace(/^Bearer /,"")||"";const row=await env.DB.prepare("SELECT id,status,amount_minor,currency,purpose,expires_at,created_at,updated_at FROM payment_orders WHERE id=?").bind(id).first<any>();if(!row)return response({error:"Order not found"},404,origin,env);const stored=await env.DB.prepare("SELECT customer_access_hash FROM payment_orders WHERE id=?").bind(id).first<any>();if(!token||!stored?.customer_access_hash||await sha256(token)!==stored.customer_access_hash)return response({error:"Unauthorized"},401,origin,env);return response({...row,amount:row.amount_minor/100},200,origin,env);}
async function adminOrders(req:Request,env:Env,origin:string){if(!(await rateLimit(req,env,"admin",60)))return response({error:"Rate limit exceeded"},429,origin,env);const identity=await requireAdmin(req,env);if(!identity)return response({error:"Unauthorized"},401,origin,env);const rows=await env.DB.prepare("SELECT id,provider_order_id,purpose,amount_minor,currency,status,provider_status,expires_at,created_at,updated_at FROM payment_orders ORDER BY created_at DESC LIMIT 100").all();return response({orders:rows.results||[],admin:identity.email},200,origin,env);}
async function cashfreeWebhook(req:Request,env:Env){
 if(!env.CASHFREE_WEBHOOK_SECRET)return new Response("Webhook not configured",{status:503,headers:SECURITY_HEADERS});
 if(Number(req.headers.get("Content-Length")||0)>1048576)return new Response("Payload too large",{status:413,headers:SECURITY_HEADERS});const raw=await req.text();if(enc.encode(raw).length>1048576)return new Response("Payload too large",{status:413,headers:SECURITY_HEADERS});const timestamp=req.headers.get("x-webhook-timestamp")||"",signature=req.headers.get("x-webhook-signature")||"";
 if(!timestamp||!signature||Math.abs(Date.now()-Number(timestamp))>5*60*1000)return new Response("Invalid timestamp",{status:400,headers:SECURITY_HEADERS});
 const key=await crypto.subtle.importKey("raw",enc.encode(env.CASHFREE_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=await crypto.subtle.sign("HMAC",key,enc.encode(timestamp+raw)),expected=b64(signed);if(!safeEqual(expected,signature))return new Response("Invalid signature",{status:401,headers:SECURITY_HEADERS});
 let data:any;try{data=JSON.parse(raw)}catch{return new Response("Invalid JSON",{status:400,headers:SECURITY_HEADERS});}
 const orderId=data?.data?.order?.order_id,cfOrder=data?.data?.order?.cf_order_id,payment=data?.data?.payment,reference=payment?.cf_payment_id||payment?.payment_id,eventType=data?.type||"unknown";
 if(!orderId||!payment)return new Response("Missing payment data",{status:400,headers:SECURITY_HEADERS});
 const row=await env.DB.prepare("SELECT * FROM payment_orders WHERE id=? OR provider_order_id=?").bind(orderId,cfOrder||orderId).first<any>();if(!row)return new Response("Order not found",{status:404,headers:SECURITY_HEADERS});
 const amt=payment.payment_amount,currency=payment.payment_currency||data?.data?.order?.order_currency||"INR",status=payment.payment_status||"UNKNOWN";
 const hash=await sha256(raw);const duplicate=await env.DB.prepare("SELECT id FROM payment_events WHERE payload_hash=? OR provider_reference=?").bind(hash,reference||null).first<any>();if(duplicate)return new Response("OK",{status:200,headers:SECURITY_HEADERS});const eventId=crypto.randomUUID(),verified=Number(amt)===row.amount_minor/100&&currency==="INR"&&row.status!=="paid";
 const state=verified?"verified":"review";
 try{await env.DB.batch([
 env.DB.prepare("INSERT OR IGNORE INTO payment_events(id,order_id,provider,provider_event_id,provider_reference,event_type,amount_minor,currency,verification_state,payload_hash) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(eventId,row.id,"cashfree",data?.event_id||null,reference||null,eventType,amt?minor(Number(amt)):null,currency,state,hash),
 env.DB.prepare("UPDATE payment_orders SET provider_status=?,status=CASE WHEN ?='SUCCESS' AND ?=1 THEN 'paid' WHEN ? IN ('FAILED','USER_DROPPED') THEN 'failed' ELSE 'review' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='paid'").bind(status,status,verified?1:0,status,row.id),
 ...(status==="SUCCESS"&&verified?[env.DB.prepare("INSERT OR IGNORE INTO ledger_entries(id,order_id,entry_type,amount_minor,currency,source_event_id) VALUES(?,?,'payment_received',?,'INR',(SELECT id FROM payment_events WHERE payload_hash=?))").bind(crypto.randomUUID(),row.id,row.amount_minor,hash)]:[])
 ]);}catch{return new Response("Webhook persistence error",{status:500,headers:SECURITY_HEADERS});}
 return new Response("OK",{status:200,headers:SECURITY_HEADERS});
}
async function adminConfig(req:Request,env:Env,origin:string){if(!(await rateLimit(req,env,"admin-write",20)))return response({error:"Rate limit exceeded"},429,origin,env);const identity=await requireAdmin(req,env);if(!identity)return response({error:"Unauthorized"},401,origin,env);const body=await req.json().catch(()=>null);if(!body||typeof body.enabled!=="boolean"||typeof body.upiId!=="string"||typeof body.beneficiary!=="string"||typeof body.instructions!=="string")return response({error:"Invalid payload"},400,origin,env);const upi=body.upiId.trim(),beneficiary=body.beneficiary.trim().slice(0,200),instructions=body.instructions.trim().slice(0,1000);if(body.enabled&&(!/^[\\w.-]{2,256}@[\\w.-]{2,64}$/.test(upi)||!beneficiary))return response({error:"Valid UPI ID and payee required"},400,origin,env);const before=await getConfig(env),after={upiId:upi,beneficiary,instructions,enabled:body.enabled,version:before.version+1,updatedAt:"pending"};await env.DB.batch([env.DB.prepare("UPDATE payment_config SET enabled=?,receiving_upi_id=?,beneficiary_display_name=?,instructions=?,version=version+1,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id='primary'").bind(body.enabled?1:0,upi,beneficiary,instructions,identity.email),env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target,before_snapshot,after_snapshot) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),identity.email,"payment_config.updated","payment_config:primary",JSON.stringify(before),JSON.stringify(after))]);return response(await getConfig(env),200,origin,env);}
export default {async fetch(req:Request,env:Env){
 const url=new URL(req.url),origin=req.headers.get("Origin")||"",path=url.pathname;
 if(path.startsWith("/api/")&&origin&&origin!==env.ALLOWED_ORIGIN)return response({error:"Origin not allowed"},403,origin,env);
 if(path.startsWith("/api/")&&req.method==="OPTIONS")return new Response(null,{status:204,headers:{...SECURITY_HEADERS,...cors(origin,env)}});
 try{
  if(path==="/api/health"&&req.method==="GET")return response({ok:true,mode:"sandbox",paymentsEnabled:env.PAYMENTS_ENABLED==="true"&&env.CASHFREE_ENV!=="production"},200,origin,env);
  if(path==="/api/payment-config"&&req.method==="GET")return response({upiId:(await getConfig(env)).upiId,beneficiary:(await getConfig(env)).beneficiary,instructions:(await getConfig(env)).instructions,enabled:false},200,origin,env);
  if(path==="/api/payment-config"&&req.method==="PUT")return adminConfig(req,env,origin);
  if(path==="/api/orders"&&req.method==="POST")return createOrder(req,env,origin);
  const match=path.match(/^\\/api\\/orders\\/([A-Za-z0-9_-]+)$/);if(match&&req.method==="GET")return getOrder(req,env,match[1],origin);
  if(path==="/api/admin/orders"&&req.method==="GET")return adminOrders(req,env,origin);
  if(path==="/api/webhooks/cashfree"&&req.method==="POST")return cashfreeWebhook(req,env);
  if(path.startsWith("/api/"))return response({error:"Not found"},404,origin,env);
  const asset=await env.ASSETS.fetch(req);const h=new Headers(asset.headers);for(const [k,v] of Object.entries(SECURITY_HEADERS))h.set(k,v);return new Response(asset.body,{status:asset.status,headers:h});
 }catch(e){return response({error:"Internal server error"},500,origin,env);}
}};
