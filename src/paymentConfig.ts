import { createClient } from "@supabase/supabase-js";

// Supabase's project URL and publishable key are safe for browser use.
// Access is controlled by Auth and RLS; never place a secret/service-role key here.
const SUPABASE_URL = "https://tybmrgfcyjjuxlnsuqdo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_u1EbOSVfGucnj-Bq2cFCVw_2we26-v2";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined || SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type PaymentConfig={
  upiId:string; beneficiary:string; instructions:string; enabled:boolean;
  cryptoEnabled:boolean; cryptoAsset:string; cryptoNetwork:string; cryptoAddress:string; cryptoInstructions:string;
  version?:number; updatedAt?:string;
};
const DEFAULTS:PaymentConfig={
  upiId:"",beneficiary:"",
  instructions:"Use the payment details shown here and keep your transaction reference for your records.",enabled:false,
  cryptoEnabled:false,cryptoAsset:"USDT",cryptoNetwork:"TRC20 (Tron)",cryptoAddress:"",
  cryptoInstructions:"Send only the selected asset on the exact network shown. Payments are manually reviewed."
};
const CONFIG_FIELDS="receiving_upi_id,beneficiary_display_name,instructions,enabled,crypto_enabled,crypto_asset,crypto_network,crypto_address,crypto_instructions,version,updated_at";
function fromRow(data:any):PaymentConfig{return {
  upiId:data.receiving_upi_id||"",beneficiary:data.beneficiary_display_name||"",instructions:data.instructions||DEFAULTS.instructions,enabled:!!data.enabled,
  cryptoEnabled:!!data.crypto_enabled,cryptoAsset:data.crypto_asset||"USDT",cryptoNetwork:data.crypto_network||"TRC20 (Tron)",cryptoAddress:data.crypto_address||"",cryptoInstructions:data.crypto_instructions||DEFAULTS.cryptoInstructions,
  version:data.version,updatedAt:data.updated_at
};}
export async function loadPaymentConfig():Promise<PaymentConfig>{
  try{const {data,error}=await supabase.from("payment_config").select(CONFIG_FIELDS).eq("id","primary").single();if(error)throw error;return fromRow(data);}
  catch{return DEFAULTS;}
}
export async function savePaymentConfig(config:PaymentConfig):Promise<PaymentConfig>{
  const {data,error}=await supabase.from("payment_config").update({
    receiving_upi_id:config.upiId,beneficiary_display_name:config.beneficiary,instructions:config.instructions,enabled:config.enabled,
    crypto_enabled:config.cryptoEnabled,crypto_asset:config.cryptoAsset,crypto_network:config.cryptoNetwork,crypto_address:config.cryptoAddress,crypto_instructions:config.cryptoInstructions
  }).eq("id","primary").select(CONFIG_FIELDS).single();
  if(error)throw error;window.dispatchEvent(new Event("xinpay-payment-config-updated"));return fromRow(data);
}
export function subscribePaymentConfig(callback:()=>void){window.addEventListener("xinpay-payment-config-updated",callback);return()=>window.removeEventListener("xinpay-payment-config-updated",callback);}
