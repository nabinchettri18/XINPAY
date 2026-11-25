import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase";
import { json, hash, secureEqual, normalizePhone, phoneDigits, telegram, serviceSecret } from "../_lib/telegram";

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Method not allowed"});}
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET||"";
  if(!secret||!secureEqual(String(req.headers["x-telegram-bot-api-secret-token"]||""),secret))return json(res,403,{error:"Forbidden"});
  try{
    const update=req.body||{}, msg=update.message;
    if(!msg?.chat?.id||!msg?.from?.id)return res.status(200).send("OK");
    const db=supabaseAdmin(), chatId=String(msg.chat.id), userId=String(msg.from.id), text=String(msg.text||"");
    if(text.startsWith("/start ")){
      const token=text.slice(7).trim(), tokenHash=hash(token);
      const {data:row,error}=await db.from("telegram_phone_verifications").select("id").eq("link_token_hash",tokenHash).eq("status","pending_link").gt("link_expires_at",new Date().toISOString()).maybeSingle();
      if(error)throw error;
      if(!row){await telegram("sendMessage",{chat_id:chatId,text:"This XinPay link has expired. Return to XinPay and connect again."});return res.status(200).send("OK");}
      const {data:linked,error:linkError}=await db.from("telegram_phone_verifications").update({telegram_chat_id:chatId,telegram_user_id:userId,status:"linked",updated_at:new Date().toISOString()}).eq("id",row.id).eq("status","pending_link").gt("link_expires_at",new Date().toISOString()).select("id").maybeSingle();
      if(linkError)throw linkError;
      if(!linked){await telegram("sendMessage",{chat_id:chatId,text:"This verification link has already been used or expired."});return res.status(200).send("OK");}
      await telegram("sendMessage",{chat_id:chatId,text:"To confirm the Telegram account matches the phone number entered on XinPay, share your own contact using the button below.",reply_markup:{keyboard:[[{text:"Share my phone number",request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});
      return res.status(200).send("OK");
    }
    if(msg.contact){
      const contact=msg.contact;
      if(String(contact.user_id||"")!==userId){await telegram("sendMessage",{chat_id:chatId,text:"Please share your own phone contact. Contacts belonging to others are not accepted."});return res.status(200).send("OK");}
      const phone=normalizePhone(String(contact.phone_number||""));
      const {data:row,error}=await db.from("telegram_phone_verifications").select("id,phone_e164").eq("telegram_user_id",userId).eq("telegram_chat_id",chatId).eq("status","linked").gt("link_expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(error)throw error;
      if(!row){await telegram("sendMessage",{chat_id:chatId,text:"No active verification was found. Return to XinPay and connect again.",reply_markup:{remove_keyboard:true}});return res.status(200).send("OK");}
      if(!phone||phoneDigits(phone)!==phoneDigits(row.phone_e164)){await db.from("telegram_phone_verifications").update({status:"failed",updated_at:new Date().toISOString()}).eq("id",row.id).eq("status","linked");await telegram("sendMessage",{chat_id:chatId,text:"The shared phone number does not match. Start again with the correct number.",reply_markup:{remove_keyboard:true}});return res.status(200).send("OK");}
      const otp=String(Number.parseInt(tokenHex(4),16)%1000000).padStart(6,"0");
      const otpHash=hash(row.id+":"+otp+":"+serviceSecret());
      const {error:updateError}=await db.from("telegram_phone_verifications").update({otp_hash:otpHash,otp_expires_at:new Date(Date.now()+5*60*1000).toISOString(),otp_attempts:0,status:"otp_sent",updated_at:new Date().toISOString()}).eq("id",row.id).eq("status","linked");
      if(updateError)throw updateError;
      await telegram("sendMessage",{chat_id:chatId,text:"XinPay OTP: "+otp+"\n\nExpires in 5 minutes. Never share this code." ,reply_markup:{remove_keyboard:true}});
      return res.status(200).send("OK");
    }
    if(text==="/start")await telegram("sendMessage",{chat_id:chatId,text:"Open XinPay and tap Connect Telegram to start phone verification."});
    return res.status(200).send("OK");
  }catch{return json(res,500,{error:"Webhook processing failed"});}
}
