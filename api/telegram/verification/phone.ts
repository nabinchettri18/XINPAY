import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { json, method, originAllowed, authenticate } from "../../_lib/telegram.js";

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,"GET"))return;
  if(!originAllowed(req))return json(res,403,{error:"Origin not allowed"});
  try{
    const user=await authenticate(req);if(!user)return json(res,401,{error:"Sign in required"});
    const {data,error}=await supabaseAdmin().from("telegram_phone_verifications").select("phone_e164,verified_at").eq("customer_id",user.id).eq("status","verified").order("verified_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    return json(res,200,{verified:!!data,phone:data?.phone_e164||null,verifiedAt:data?.verified_at||null});
  }catch{return json(res,503,{error:"Verification service unavailable"});}
}
