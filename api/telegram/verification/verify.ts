import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase";
import { json, method, originAllowed, limited, requestIp, hash, serviceSecret, secureEqual } from "../../_lib/telegram";

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,"POST"))return;
  if(!originAllowed(req))return json(res,403,{error:"Origin not allowed"});
  const id=String(req.body?.verificationId||""),otp=String(req.body?.otp||"").replace(/\D/g,"");
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9]{6}$/.test(otp))return json(res,400,{error:"Enter the six-digit OTP."});
  try{
    if(!(await limited("verify:"+id+":"+requestIp(req),10,600)))return json(res,429,{error:"Too many attempts. Try again later."});
    const db=supabaseAdmin(),{data:row,error}=await db.from("telegram_phone_verifications").select("otp_hash,status,otp_expires_at,phone_e164").eq("id",id).maybeSingle();
    if(error)throw error;if(!row||row.status!=="otp_sent")return json(res,400,{error:"No active OTP. Start verification again."});
    if(!row.otp_expires_at||Date.parse(row.otp_expires_at)<=Date.now()){await db.from("telegram_phone_verifications").update({status:"expired"}).eq("id",id).eq("status","otp_sent");return json(res,400,{error:"OTP expired. Restart verification."});}
    const {data:attempt,error:attemptError}=await db.rpc("consume_telegram_otp_attempt",{p_id:id});if(attemptError)throw attemptError;
    if(Number(attempt)<0)return json(res,429,{error:"Too many attempts or OTP expired. Restart verification."});
    const expected=hash(id+":"+otp+":"+serviceSecret());
    if(!secureEqual(expected,String(row.otp_hash||""))){if(Number(attempt)>=5)await db.from("telegram_phone_verifications").update({status:"failed"}).eq("id",id).eq("status","otp_sent");return json(res,400,{error:"Incorrect OTP"});}
    const {data:updated,error:updateError}=await db.from("telegram_phone_verifications").update({status:"verified",verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("status","otp_sent").gt("otp_expires_at",new Date().toISOString()).select("phone_e164").maybeSingle();
    if(updateError)throw updateError;if(!updated)return json(res,400,{error:"OTP expired or already used."});
    return json(res,200,{verified:true,phone:updated.phone_e164});
  }catch{return json(res,503,{error:"Verification service unavailable"});}
}
