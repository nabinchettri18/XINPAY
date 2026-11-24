export type PaymentConfig = { upiId:string; beneficiary:string; instructions:string; enabled:boolean; version?:number; updatedAt?:string };
const DEFAULTS: PaymentConfig = { upiId:"", beneficiary:"", instructions:"Use the payment details shown here and keep your transaction reference for your records.", enabled:false };
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/,"");
const endpoint = API_BASE + "/api/payment-config";
const TOKEN_KEY = "xinpay.admin-api-token";
export function getAdminToken(){try{return sessionStorage.getItem(TOKEN_KEY)||""}catch{return ""}}
export function setAdminToken(token:string){try{sessionStorage.setItem(TOKEN_KEY,token)}catch{}}
export async function loadPaymentConfig():Promise<PaymentConfig>{
 try{const res=await fetch(endpoint,{headers:{Accept:"application/json"}});if(!res.ok)throw new Error("API unavailable");const data=await res.json();return {...DEFAULTS,...data}}catch{return DEFAULTS}
}
export async function savePaymentConfig(config:PaymentConfig,token:string):Promise<PaymentConfig>{
 const res=await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(config)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(data.error||"Could not save payment settings");
 window.dispatchEvent(new Event("xinpay-payment-config-updated"));
 return {...DEFAULTS,...data};
}
export function subscribePaymentConfig(callback:()=>void){window.addEventListener("xinpay-payment-config-updated",callback);return()=>window.removeEventListener("xinpay-payment-config-updated",callback);}
