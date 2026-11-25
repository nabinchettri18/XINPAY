import { context, fail, json, method } from "../../server/xinpay-api.js";
const fields = "id,account_holder_name,bank_name,account_last4,ifsc_code,account_type,branch_name,upi_id,verification_status,is_primary,notes,created_at,updated_at";
const clean = (v,max=120)=>String(v||"").trim().slice(0,max);
function valid(body){
 const holder=clean(body.accountHolderName,100), bank=clean(body.bankName,100), last4=clean(body.accountLast4,4), ifsc=clean(body.ifscCode,11).toUpperCase();
 if(holder.length<2||bank.length<2||!/^[0-9]{4}$/.test(last4)||!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))return null;
 const upi=clean(body.upiId,255);
 if(upi&&!/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(upi))return null;
 return {account_holder_name:holder,bank_name:bank,account_last4:last4,ifsc_code:ifsc,account_type:clean(body.accountType,30)||"Savings",branch_name:clean(body.branchName,120),upi_id:upi,notes:clean(body.notes,1000)};
}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method||"")){res.setHeader("Allow","GET, POST");return fail(res,405,"Method not allowed.");}
 if(!method(req,res,req.method))return;
 const auth=await context(req,{admin:true});if(auth.error)return fail(res,auth.error.status,auth.error.message);
 try{
  if(req.method==="GET"){
   const {data,error}=await auth.db.from("xinpay_bank_accounts").select(fields).eq("is_archived",false).order("is_primary",{ascending:false}).order("created_at",{ascending:false}).limit(100);
   if(error)throw error;return json(res,200,{accounts:data||[]});
  }
  const b=req.body&&typeof req.body==="object"?req.body:{},action=clean(b.action,20);
  if(action==="create"){
   const values=valid(b);if(!values)return fail(res,400,"Please provide a valid account holder, bank, last four digits, IFSC and optional UPI ID.");
   const {data,error}=await auth.db.from("xinpay_bank_accounts").insert({...values,created_by:auth.user.id,updated_by:auth.user.id}).select(fields).single();
   if(error)throw error;return json(res,201,{account:data});
  }
  if(action==="update"){
   const id=clean(b.id,80),values=valid(b);if(!id||!values)return fail(res,400,"Invalid account ID or bank details.");
   const {data,error}=await auth.db.from("xinpay_bank_accounts").update({...values,updated_by:auth.user.id}).eq("id",id).eq("is_archived",false).select(fields).single();
   if(error)throw error;if(!data)return fail(res,404,"Bank account not found.");return json(res,200,{account:data});
  }
  const id=clean(b.id,80);if(!id)return fail(res,400,"Account ID required.");
  if(action==="verify"){
   const {data,error}=await auth.db.from("xinpay_bank_accounts").update({verification_status:"verified",verified_by:auth.user.id,verified_at:new Date().toISOString(),updated_by:auth.user.id}).eq("id",id).eq("is_archived",false).select(fields).single();
   if(error)throw error;if(!data)return fail(res,404,"Bank account not found.");return json(res,200,{account:data});
  }
  if(action==="primary"){
   const {error:clearError}=await auth.db.from("xinpay_bank_accounts").update({is_primary:false,updated_by:auth.user.id}).eq("is_archived",false);
   if(clearError)throw clearError;
   const {data,error}=await auth.db.from("xinpay_bank_accounts").update({is_primary:true,updated_by:auth.user.id}).eq("id",id).eq("is_archived",false).select(fields).single();
   if(error)throw error;if(!data)return fail(res,404,"Bank account not found.");return json(res,200,{account:data});
  }
  if(action==="archive"){
   const {data,error}=await auth.db.from("xinpay_bank_accounts").update({is_archived:true,is_primary:false,updated_by:auth.user.id}).eq("id",id).eq("is_archived",false).select(fields).single();
   if(error)throw error;if(!data)return fail(res,404,"Bank account not found.");return json(res,200,{account:data});
  }
  return fail(res,400,"Unknown account action.");
 }catch(e){return fail(res,503,e.message||"Bank account service unavailable.");}
}
