import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { json, method, originAllowed, authenticate } from "../../_lib/telegram.js";

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,"GET"))return;
  if(!originAllowed(req))return json(res,403,{error:"Origin not allowed"});
  const id=String(req.query.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:"Invalid verification ID"});
  try{
    const user=await authenticate(req);if(!user)return json(res,401,{error:"Sign in required"});
    const db=supabaseAdmin(),{data,error}=await db.from("telegram_phone_verifications").select("status,phone_e164,link_expires_at,otp_expires_at").eq("id",id).eq("customer_id",user.id).maybeSingle();
    if(error)throw error;if(!data)return json(res,404,{error:"Verification not found"});
    let status=data.status;
    if(["pending_link","linked"].includes(status)&&Date.parse(data.link_expires_at)<=Date.now()){await db.from("telegram_phone_verifications").update({status:"expired"}).eq("id",id).eq("customer_id",user.id).in("status",["pending_link","linked"]);status="expired";}
    if(status==="otp_sent"&&data.otp_expires_at&&Date.parse(data.otp_expires_at)<=Date.now()){await db.from("telegram_phone_verifications").update({status:"expired"}).eq("id",id).eq("customer_id",user.id).eq("status","otp_sent");status="expired";}
    return json(res,200,{status,phone:status==="verified"?data.phone_e164:undefined,expiresInSeconds:status==="otp_sent"?Math.max(0,Math.floor((Date.parse(data.otp_expires_at||"")-Date.now())/1000)):undefined});
  }catch{return json(res,503,{error:"Verification service unavailable"});}
}
