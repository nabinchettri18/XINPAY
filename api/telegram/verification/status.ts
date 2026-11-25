import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase";
import { json, method, originAllowed } from "../../_lib/telegram";

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,"GET"))return;
  if(!originAllowed(req))return json(res,403,{error:"Origin not allowed"});
  const id=String(req.query.id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:"Invalid verification ID"});
  try{
    const db=supabaseAdmin();
    const {data,error}=await db.from("telegram_phone_verifications").select("status,phone_e164,link_expires_at,otp_expires_at").eq("id",id).maybeSingle();
    if(error)throw error;
    if(!data)return json(res,404,{error:"Verification not found"});
    let status=data.status;
    if(status==="pending_link"&&Date.parse(data.link_expires_at)<=Date.now()){await db.from("telegram_phone_verifications").update({status:"expired"}).eq("id",id).eq("status","pending_link");status="expired";}
    if(status==="linked"&&Date.parse(data.link_expires_at)<=Date.now()){await db.from("telegram_phone_verifications").update({status:"expired"}).eq("id",id).eq("status","linked");status="expired";}
    if(status==="otp_sent"&&data.otp_expires_at&&Date.parse(data.otp_expires_at)<=Date.now()){await db.from("telegram_phone_verifications").update({status:"expired"}).eq("id",id).eq("status","otp_sent");status="expired";}
    return json(res,200,{status,phone:status==="verified"?data.phone_e164:undefined,expiresInSeconds:status==="otp_sent"?Math.max(0,Math.floor((Date.parse(data.otp_expires_at||"")-Date.now())/1000)):undefined});
  }catch{return json(res,503,{error:"Verification service unavailable"});}
}
