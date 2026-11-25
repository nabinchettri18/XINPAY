import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./supabase.js";

export function json(res:VercelResponse,status:number,data:unknown){res.status(status).setHeader("Cache-Control","no-store").json(data);}
export function method(req:VercelRequest,res:VercelResponse,allowed:string){if(req.method!==allowed){res.setHeader("Allow",allowed);json(res,405,{error:"Method not allowed"});return false;}return true;}
export function originAllowed(req:VercelRequest){const origin=req.headers.origin;if(!origin)return true;const configured=(process.env.APP_ORIGINS||process.env.APP_ORIGIN||"").split(",").map(x=>x.trim()).filter(Boolean);const vercelHost=process.env.VERCEL_URL?"https://"+process.env.VERCEL_URL:"";return configured.includes(origin)||origin===vercelHost||/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);}
export function hash(value:string){return createHash("sha256").update(value).digest("hex");}
export function secureEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function tokenHex(bytes=32){return randomBytes(bytes).toString("hex");}
export function normalizePhone(value:string){const digits=value.replace(/\D/g,"");if(digits.length===10)return "+91"+digits;if(digits.length===12&&digits.startsWith("91"))return "+"+digits;if(value.trim().startsWith("+")&&digits.length>=10&&digits.length<=15)return "+"+digits;return "";}
export function phoneDigits(value:string){return value.replace(/\D/g,"");}
export async function limited(bucket:string,max:number,seconds:number){const {data,error}=await supabaseAdmin().rpc("consume_telegram_rate_limit",{p_bucket:bucket,p_max_hits:max,p_window_seconds:seconds});if(error)throw error;return data===true;}
export function requestIp(req:VercelRequest){const forwarded=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim();return hash(forwarded||String(req.headers["x-real-ip"]||"unknown"));}
export async function authenticate(req:VercelRequest){const header=String(req.headers.authorization||"");if(!header.startsWith("Bearer "))return null;const {data,error}=await supabaseAdmin().auth.getUser(header.slice(7));if(error||!data.user)return null;return data.user;}
export async function telegram(methodName:string,payload:unknown){const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)throw new Error("Telegram bot is not configured");const r=await fetch("https://api.telegram.org/bot"+token+"/"+methodName,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data:any=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error("Telegram API request failed");return data.result;}
export function serviceSecret(){return process.env.OTP_HASH_SECRET||process.env.TELEGRAM_WEBHOOK_SECRET||"";}
