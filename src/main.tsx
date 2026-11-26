import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CustomerApp from "./CustomerApp";
import ProofReview from "./ProofReview";
import AdminWithdrawals from "./AdminWithdrawals";
import AdminWalletTopups from "./AdminWalletTopups";
import AdminReferrals from "./AdminReferrals";
import { supabase } from "./paymentConfig";
import { ShieldCheck } from "lucide-react";
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

type AdminState="checking"|"signed_out"|"denied"|"mfa_setup"|"mfa_challenge"|"allowed";
function AdminAuth({children}:{children:React.ReactNode}){
  const [state,setState]=useState<AdminState>("checking");
  const [adminEmail,setAdminEmail]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [factorId,setFactorId]=useState("");
  const [challengeId,setChallengeId]=useState("");
  const [mfaCode,setMfaCode]=useState("");
  const [totpQr,setTotpQr]=useState("");
  const [totpSecret,setTotpSecret]=useState("");

  const checkAdmin=async()=>{
    setState("checking");setError("");
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user){setAdminEmail("");setState("signed_out");return false;}
    setAdminEmail(user.email||"");
    const {data:adminFlag,error:roleError}=await supabase.rpc("is_xinpay_admin");
    if(roleError||adminFlag!==true){setState("denied");return false;}

    // Admin accounts must complete TOTP MFA (AAL2) before any admin UI is rendered.
    const {data:aal,error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aalError){setError("Could not verify multi-factor authentication status.");setState("denied");return false;}
    if(aal.currentLevel==="aal2"){setState("allowed");return true;}

    const {data:factors,error:factorsError}=await supabase.auth.mfa.listFactors();
    if(factorsError){setError("Could not load MFA factors. Try signing in again.");setState("denied");return false;}
    const verifiedTotp=factors.totp?.find(f=>f.status==="verified");
    if(verifiedTotp){
      const challenge=await supabase.auth.mfa.challenge({factorId:verifiedTotp.id});
      if(challenge.error){setError("Could not start authenticator verification.");setState("denied");return false;}
      setFactorId(verifiedTotp.id);setChallengeId(challenge.data.id);setMfaCode("");setState("mfa_challenge");return false;
    }

    // Clean up an unfinished enrollment, then start a fresh enrollment.
    const pending=factors.totp?.find(f=>f.status==="unverified");
    if(pending){await supabase.auth.mfa.unenroll({factorId:pending.id});}
    const enrolled=await supabase.auth.mfa.enroll({factorType:"totp",friendlyName:"EasePay Admin"});
    if(enrolled.error){setError("Authenticator setup failed. Check Supabase MFA settings and retry.");setState("denied");return false;}
    setFactorId(enrolled.data.id);
    setTotpQr(enrolled.data.totp.qr_code);
    setTotpSecret(enrolled.data.totp.secret);
    setMfaCode("");setChallengeId("");setState("mfa_setup");
    return false;
  };

  useEffect(()=>{
    let active=true;
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!active)return;
      if(!session){setState("signed_out");return;}
      void checkAdmin();
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!active)return;
      if(!session){setState("signed_out");setAdminEmail("");setFactorId("");setChallengeId("");setTotpQr("");setTotpSecret("");}
      else if(event==="TOKEN_REFRESHED"){window.setTimeout(()=>{if(active)void checkAdmin();},0);}
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[]);

  const signIn=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError("");
    const {data,error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(signInError){setError("Sign-in failed. Check your credentials.");setBusy(false);return;}
    if(!data.session){setError("No authenticated session was returned.");setBusy(false);return;}
    const {data:verifiedUser,error:userError}=await supabase.auth.getUser(data.session.access_token);
    if(userError||!verifiedUser.user){setError("Unable to validate your session. Please try again.");await supabase.auth.signOut();setBusy(false);return;}
    setAdminEmail(verifiedUser.user.email||"");
    const {data:adminFlag,error:roleError}=await supabase.rpc("is_xinpay_admin");
    if(roleError||adminFlag!==true){
      setState("denied");setError("");await supabase.auth.signOut();setBusy(false);return;
    }
    setBusy(false);await checkAdmin();
  };

  const verifyMfa=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError("");
    if(!/^\d{6}$/.test(mfaCode)){setError("Enter the 6-digit authenticator code.");setBusy(false);return;}
    try{
      let currentChallenge=challengeId;
      if(state==="mfa_setup"||!currentChallenge){
        const challenge=await supabase.auth.mfa.challenge({factorId});
        if(challenge.error)throw challenge.error;
        currentChallenge=challenge.data.id;
      }
      const verified=await supabase.auth.mfa.verify({factorId,challengeId:currentChallenge,code:mfaCode});
      if(verified.error)throw verified.error;
      const {data:aal,error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if(aalError||aal.currentLevel!=="aal2")throw new Error("MFA verification did not establish the required security level.");
      setState("allowed");setMfaCode("");setTotpQr("");setTotpSecret("");setError("");
    }catch(err){setError(err instanceof Error?err.message:"Authenticator verification failed.");}
    finally{setBusy(false);}
  };

  const signOut=async()=>{await supabase.auth.signOut();setState("signed_out");setAdminEmail("");setPassword("");setError("");setMfaCode("");setTotpQr("");setTotpSecret("");};

  if(state==="checking")return <div className="xp-auth-loading">Checking administrator access and MFA…</div>;
  if(state==="allowed")return <>{children}</>;
  if(state==="denied")return <div className="xp-auth-wrap"><section className="xp-auth-card xp-admin-denied"><div className="xp-admin-security-icon">⛨</div><div className="xp-auth-kicker">RESTRICTED ADMIN AREA</div><h1>Access denied</h1><p>This account is not authorized or its security verification could not be completed. Admin access is controlled by the server-side allowlist.</p>{adminEmail&&<div className="xp-admin-identity">{adminEmail}</div>}{error&&<div className="xp-proof-error">{error}</div>}<button type="button" className="xp-primary" onClick={signOut}>Sign out and switch account</button></section></div>;
  if(state==="mfa_setup"||state==="mfa_challenge")return <div className="xp-auth-wrap"><form className="xp-auth-card xp-admin-mfa-card" onSubmit={verifyMfa}><div className="xp-admin-security-icon"><ShieldCheck size={24}/></div><div className="xp-auth-kicker">ADMIN MULTI-FACTOR SECURITY</div><h1>{state==="mfa_setup"?"Set up authenticator":"Verify authenticator"}</h1><p>{state==="mfa_setup"?"Admin access requires a time-based authenticator. Scan the QR code with your authenticator app, then enter the 6-digit code to activate it.":"Enter the current 6-digit code from your authenticator app to continue to the admin portal."}{adminEmail&&<span className="xp-admin-identity">{adminEmail}</span>}</p>{state==="mfa_setup"&&<div className="xp-totp-enrollment"><img alt="Authenticator enrollment QR code" src={"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(totpQr)}/><label>Manual setup key<code>{totpSecret}</code></label><small>Store this key securely. Never share it with anyone.</small></div>}<label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label><button className="xp-primary" disabled={busy||mfaCode.length!==6}>{busy?"Verifying…":state==="mfa_setup"?"Enable MFA & continue":"Verify & continue"}</button>{error&&<div className="xp-proof-error">{error}</div>}<button type="button" className="xp-secondary" onClick={signOut}>Sign out</button></form></div>;
  return <div className="xp-auth-wrap"><form className="xp-auth-card" onSubmit={signIn}><div className="xp-brand"><span className="xp-brand-mark">e</span><span className="xp-brand-word">easepay<small>PAYMENT OPERATIONS</small></span></div><div className="xp-auth-kicker">RESTRICTED ADMIN AREA</div><h1>Admin sign in</h1><p>Only allowlisted administrator accounts can access this portal. TOTP MFA is required.</p><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="xp-primary" disabled={busy}>{busy?"Verifying access…":"Sign in securely"}</button>{error&&<div className="xp-proof-error">{error}</div>}<div className="xp-admin-login-note">Access is verified against Supabase Auth, the server-side admin allowlist and a required authenticator factor.</div></form></div>;
}
