import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CustomerApp from "./CustomerApp";
import { supabase } from "./paymentConfig";
import "./styles.css";
import "./customer.css";

const isCustomer = window.location.pathname.startsWith("/customer");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isCustomer ? <CustomerApp /> : <AdminAuth><App /></AdminAuth>}</React.StrictMode>
);

function AdminAuth({children}:{children:React.ReactNode}){const [session,setSession]=useState<any>(null);const [ready,setReady]=useState(false);const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);if(!ready)return <div className="xp-auth-loading">Loading secure admin portal…</div>;if(session)return <>{children}</>;return <div className="xp-auth-wrap"><form className="xp-auth-card" onSubmit={async e=>{e.preventDefault();setError("");const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)setError(error.message)}}><div className="xp-brand"><span className="xp-brand-mark">x</span><span className="xp-brand-word">xinpay<small>PAYMENT OPERATIONS</small></span></div><h1>Admin sign in</h1><p>Sign in with your authorized XinPay admin account.</p><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="xp-primary">Sign in</button>{error&&<div className="xp-proof-error">{error}</div>}</form></div>}
