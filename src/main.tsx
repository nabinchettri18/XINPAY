import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CustomerApp from "./CustomerApp";
import ProofReview from "./ProofReview";
import AdminWithdrawals from "./AdminWithdrawals";
import AdminWalletTopups from "./AdminWalletTopups";
import AdminReferrals from "./AdminReferrals";
import { supabase } from "./paymentConfig";
import "./styles.css";
import "./customer.css";

const path=window.location.pathname;
const isCustomer=path==="/"||path.startsWith("/customer");
const isProofReview=path.startsWith("/admin/proofs");
const isWithdrawals=path.startsWith("/admin/withdrawals");
const isWalletTopups=path.startsWith("/admin/topups");
const isReferrals=path.startsWith("/admin/referrals");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isCustomer?<CustomerApp />:
      isProofReview?<AdminAuth><ProofReview /></AdminAuth>:
      isWithdrawals?<AdminAuth><AdminWithdrawals /></AdminAuth>:
      isWalletTopups?<AdminAuth><AdminWalletTopups /></AdminAuth>:
      isReferrals?<AdminAuth><AdminReferrals /></AdminAuth>:
      <AdminAuth><App /></AdminAuth>}
  </React.StrictMode>
);

type AdminState="checking"|"signed_out"|"denied"|"allowed";
function AdminAuth({children}:{children:React.ReactNode}){
  const [state,setState]=useState<AdminState>("checking");
  const [adminEmail,setAdminEmail]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  const checkAdmin=async()=>{
    setState("checking");
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user){setAdminEmail("");setState("signed_out");return false;}
    setAdminEmail(user.email||"");
    const {data,error:roleError}=await supabase.rpc("is_xinpay_admin");
    if(roleError||data!==true){setState("denied");return false;}
    setState("allowed");
    return true;
  };

  useEffect(()=>{
    let active=true;
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!active)return;
      if(!session){setState("signed_out");return;}
      void checkAdmin();
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      if(!session){setState("signed_out");setAdminEmail("");return;}
      // Defer network auth checks until Supabase finishes its auth event.
      window.setTimeout(()=>{if(active)void checkAdmin();},0);
    });
    const onFocus=()=>{if(document.visibilityState==="visible")void checkAdmin();};
    document.addEventListener("visibilitychange",onFocus);
    return()=>{active=false;subscription.unsubscribe();document.removeEventListener("visibilitychange",onFocus);};
  },[]);

  const signIn=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError("");
    const {data,error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(signInError){setError("Sign-in failed. Check your credentials.");setBusy(false);return;}
    if(!data.session){setError("No authenticated session was returned.");setBusy(false);return;}
    const {data:verifiedUser,error:userError}=await supabase.auth.getUser(data.session.access_token);
    if(userError||!verifiedUser.user){setError("Unable to validate your session. Please try again.");await supabase.auth.signOut();setBusy(false);return;}
    const {data:isAdmin,error:roleError}=await supabase.rpc("is_xinpay_admin");
    if(roleError||isAdmin!==true){
      setAdminEmail(verifiedUser.user.email||"");
      setState("denied");
      setError("");
      await supabase.auth.signOut();
      setBusy(false);
      return;
    }
    setAdminEmail(verifiedUser.user.email||"");
    setState("allowed");setBusy(false);
  };

  const signOut=async()=>{await supabase.auth.signOut();setState("signed_out");setAdminEmail("");setPassword("");setError("");};

  if(state==="checking")return <div className="xp-auth-loading">Checking admin authorization…</div>;
  if(state==="allowed")return <>{children}</>;
  if(state==="denied")return <div className="xp-auth-wrap"><section className="xp-auth-card xp-admin-denied"><div className="xp-admin-security-icon">⛨</div><div className="xp-auth-kicker">RESTRICTED ADMIN AREA</div><h1>Access denied</h1><p>This signed-in account is not on the EasePay administrator allowlist. Admin access is granted server-side and cannot be self-assigned.</p>{adminEmail&&<div className="xp-admin-identity">{adminEmail}</div>}<button type="button" className="xp-primary" onClick={signOut}>Sign out and switch account</button></section></div>;
  return <div className="xp-auth-wrap"><form className="xp-auth-card" onSubmit={signIn}><div className="xp-brand"><span className="xp-brand-mark">e</span><span className="xp-brand-word">easepay<small>PAYMENT OPERATIONS</small></span></div><div className="xp-auth-kicker">RESTRICTED ADMIN AREA</div><h1>Admin sign in</h1><p>Only accounts on the administrator allowlist can access this portal.</p><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="xp-primary" disabled={busy}>{busy?"Verifying access…":"Sign in securely"}</button>{error&&<div className="xp-proof-error">{error}</div>}<div className="xp-admin-login-note">Access is checked against Supabase Auth and the server-side admin allowlist on every session validation.</div></form></div>;
}
