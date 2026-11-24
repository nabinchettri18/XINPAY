export interface Env { DB: D1Database; ADMIN_TOKEN: string; ALLOWED_ORIGIN?: string; }
type Config = { upiId:string; beneficiary:string; instructions:string; enabled:boolean; version:number; updatedAt:string };
const DEFAULT: Config = { upiId:"", beneficiary:"", instructions:"Use the payment details shown here and keep your transaction reference for your records.", enabled:false, version:0, updatedAt:"" };
const headers=(origin:string,env:Env)=>({ "Content-Type":"application/json; charset=utf-8", "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN||origin||"*", "Access-Control-Allow-Methods":"GET, PUT, OPTIONS", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Vary":"Origin" });
function json(data:unknown,status:number,origin:string,env:Env){return new Response(JSON.stringify(data),{status,headers:headers(origin,env)});}
function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function mapRow(row:any):Config{return {upiId:row.receiving_upi_id||"",beneficiary:row.beneficiary_display_name||"",instructions:row.instructions||DEFAULT.instructions,enabled:!!row.enabled,version:Number(row.version||0),updatedAt:row.updated_at||""};}
async function readConfig(env:Env){const row=await env.DB.prepare("SELECT * FROM payment_config WHERE id='primary'").first<any>();return row?mapRow(row):DEFAULT;}
async function ensureRow(env:Env){await env.DB.prepare("INSERT OR IGNORE INTO payment_config (id,enabled,receiving_upi_id,beneficiary_display_name,instructions,qr_mode,version) VALUES ('primary',0,'','','','generated',0)").run();}
export default { async fetch(req:Request,env:Env){
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin,env)});
 const url=new URL(req.url);
 if(url.pathname!=="/api/payment-config")return json({error:"Not found"},404,origin,env);
 if(req.method==="GET"){try{return json(await readConfig(env),200,origin,env)}catch{return json({error:"Configuration unavailable"},500,origin,env)}}
 if(req.method!=="PUT")return json({error:"Method not allowed"},405,origin,env);
 const auth=req.headers.get("Authorization")||"";
 if(!env.ADMIN_TOKEN||!auth.startsWith("Bearer ")||!constantTimeEqual(auth.slice(7),env.ADMIN_TOKEN))return json({error:"Unauthorized"},401,origin,env);
 let body:any;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400,origin,env)}
 const upiId=String(body.upiId||"").trim(), beneficiary=String(body.beneficiary||"").trim().slice(0,200), instructions=String(body.instructions||"").trim().slice(0,1000), enabled=body.enabled===true;
 const valid=/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId);
 if(enabled&&(!valid||!beneficiary))return json({error:"A valid UPI ID and payee name are required to enable collection"},400,origin,env);
 if(upiId&&!valid)return json({error:"Invalid UPI ID format"},400,origin,env);
 try{await ensureRow(env);const before=await readConfig(env);await env.DB.prepare("UPDATE payment_config SET enabled=?,receiving_upi_id=?,beneficiary_display_name=?,instructions=?,qr_mode='generated',version=version+1,updated_at=CURRENT_TIMESTAMP,updated_by='admin-token' WHERE id='primary'").bind(enabled?1:0,upiId,beneficiary,instructions).run();const after=await readConfig(env);await env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target,before_snapshot,after_snapshot) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),"admin-token","payment_config.updated","payment_config:primary",JSON.stringify(before),JSON.stringify(after)).run();return json(after,200,origin,env)}catch{return json({error:"Could not save configuration"},500,origin,env)}
 },};
