import React from "react";
export default function EasePayLogo({className="",compact=false,inverse=false}:{className?:string;compact?:boolean;inverse?:boolean}){
 const id="easepay-gradient";
 return <svg className={className+" easepay-logo"+(inverse?" easepay-logo-inverse":"")} viewBox={compact?"0 0 100 100":"0 0 460 112"} role="img" aria-label="EasePay">
 <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#B62CFF"/><stop offset="48%" stopColor="#263BFF"/><stop offset="100%" stopColor="#00C7E8"/></linearGradient></defs>
 <g transform={compact?"translate(7 6) scale(.86)":"translate(2 5)"}>
 <path fill={"url(#"+id+")"} d="M72 4 20 4 8 45 55 45 Q70 45 76 32 L88 5Z"/>
 <path fill={"url(#"+id+")"} d="M17 49 Q5 49 1 65 L-2 83 Q-4 96 10 96 L59 96 Q75 96 82 82 L91 63 L40 63 Q32 63 30 73 L26 79 L56 79 Q67 79 71 68 L75 57 L26 57Z"/>
 <path fill="#fff" d="M42 42 64 53 42 66 Q38 68 38 63 L44 54 38 46 Q38 41 42 42Z"/>
 </g>
 {!compact && <><text x="112" y="75" className="easepay-logo-word">EASE<tspan fill={"url(#"+id+")"}>PAY</tspan></text><path d="M154 99 Q270 70 390 95" fill="none" stroke={"url(#"+id+")"} strokeWidth="3.5" strokeLinecap="round"/></>}
 </svg>;
}