export type PaymentConfig = { upiId:string; beneficiary:string; instructions:string; enabled:boolean; version?:number; updatedAt?:string };
const DEFAULTS: PaymentConfig = { upiId:"", beneficiary:"", instructions:"Use the payment details shown here and keep your transaction reference for your records.", enabled:false };
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/,"");
const endpoint = API_BASE + "/api/payment-config";

export async function loadPaymentConfig():Promise<PaymentConfig>{
 try{const res=await fetch(endpoint,{headers:{Accept:"application/json"},cache:"no-store"});if(!res.ok)throw new Error("API unavailable");const data=await res.json();return {...DEFAULTS,...data}}catch{return DEFAULTS}
}
export async function savePaymentConfig(config:PaymentConfig):Promise<PaymentConfig>{
 const res=await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(config),cache:"no-store"});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(data.error||"Could not save payment settings");
 window.dispatchEvent(new Event("xinpay-payment-config-updated"));
 return {...DEFAULTS,...data};
}
export function subscribePaymentConfig(callback:()=>void){window.addEventListener("xinpay-payment-config-updated",callback);return()=>window.removeEventListener("xinpay-payment-config-updated",callback);}
