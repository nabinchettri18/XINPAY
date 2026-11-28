import React, { useId } from "react";
export default function EasePayLogo({className="",compact=false,inverse=false}:{className?:string;compact?:boolean;inverse?:boolean}){
 const id="easepay-gradient-"+useId().replace(/:/g,"");
 return <svg className={className+" easepay-logo"+(inverse?" easepay-logo-inverse":"")} viewBox={compact?"0 0 100 100":"0 0 500 120"} role="img" aria-label="EasePay" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6D3BFF"/><stop offset="48%" stopColor="#176BFF"/><stop offset="100%" stopColor="#00D2F0"/></linearGradient>
  <linearGradient id={id+"pay"} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#168BFF"/><stop offset="100%" stopColor="#7C35FF"/></linearGradient>
 </defs>
 <g transform={compact?"translate(5 5) scale(.9)":"translate(4 8)"}>
  <path fill={`url(#${id})`} d="M75 3H26C16 3 10 10 7 20L0 47h50c15 0 25-7 31-20L91 3Z"/>
  <path fill="#101C45" d="M15 48 52 48c13 0 20-6 27-17l12-25-14 37-7 19c-5 13-17 19-32 19H10c-9 0-13-6-10-15l8-23Z"/>
  <path fill={`url(#${id+"pay"})`} d="M14 54h46c13 0 21-7 27-19l9-18-13 40c-5 16-17 25-34 25H14C2 82-4 74 0 63l4-9Z"/>
  <path fill="#fff" d="M40 35 69 51 40 68c-5 3-9-1-7-6l8-11-8-10c-3-5 1-9 5-6Z"/>
 </g>
 {!compact&&<><text x="120" y="76" fontFamily="Manrope, Inter, Arial, sans-serif" fontSize="48" fontWeight="950" letterSpacing="-1.8" fill={inverse?"#FFFFFF":"#0B1930"}>EASE<tspan fill={`url(#${id+"pay"})`}>PAY</tspan></text><path d="M132 101Q270 75 435 94" fill="none" stroke={`url(#${id+"pay"})`} strokeWidth="4" strokeLinecap="round"/></>}
 </svg>;
}
