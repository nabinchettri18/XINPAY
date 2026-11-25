import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase";
import { json, method, originAllowed, limited, requestIp, hash, tokenHex, normalizePhone, serviceSecret } from "../../_lib/telegram";

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,"POST"))return;
  if(!originAllowed(req))return json(res,403,{error:"Origin not allowed"});
  if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_BOT_USERNAME||!process.env.TELEGRAM_WEBHOOK_SECRET||!serviceSecret())return json(res,503,{error:"Telegram verification is not configured."});
  try{
    if(!(await limited("start:"+requestIp(req),8,600)))return json(res,429,{error:"Too many verification requests. Try again later."});
    const phone=normalizePhone(String(req.body?.phone||""));
    if(!phone)return json(res,400,{error:"Enter a valid phone number."});
    const username=String(process.env.TELEGRAM_BOT_USERNAME).replace(/^@/,"").trim();
    const id=crypto.randomUUID(),token=tokenHex(),db=supabaseAdmin();
    const {error}=await db.from("telegram_phone_verifications").insert({id,phone_e164:phone,link_token_hash:hash(token),status:"pending_link",link_expires_at:new Date(Date.now()+10*60*1000).toISOString()});
    if(error)throw error;
    return json(res,200,{verificationId:id,telegramUrl:"https://t.me/"+username+"?start="+token,expiresInSeconds:600});
  }catch{return json(res,503,{error:"Verification service unavailable"});}
}
