import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";

export type AuthUser = { id:string; name:string; email:string; emailVerifiedAt:string|null; createdAt:string };
type Mode = "login" | "register" | "forgot" | "reset";
type Props = { onAuthenticated:(user:AuthUser)=>void };

export default function CustomerAuth({onAuthenticated}:Props) {
  const [mode,setMode] = useState<Mode>("login");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [resetToken,setResetToken] = useState("");
  const [verificationEmail,setVerificationEmail] = useState("");
  const [verified,setVerified] = useState(false);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const verifyToken=params.get("token");
    if(window.location.pathname.endsWith("/verify-email")&&verifyToken){
      setBusy(true);
      fetch("/api/auth/verify-email",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:verifyToken})})
        .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"This verification link is invalid or expired.");setVerified(true);window.history.replaceState({},"","/customer");onAuthenticated(d.user);})
        .catch(e=>setError(e instanceof Error?e.message:"Could not verify your email."))
        .finally(()=>setBusy(false));
    }
    if(window.location.pathname.endsWith("/reset-password")&&verifyToken){setResetToken(verifyToken);setMode("reset");}
  },[onAuthenticated]);

  function switchMode(next:Mode){setMode(next);setError("");setMessage("");setPassword("");setConfirmPassword("");}
  async function submit(e:FormEvent){
    e.preventDefault();setError("");setMessage("");
    if(mode==="register"&&(name.trim().length<2||name.trim().length>100)){setError("Enter your full name.");return;}
    if(mode==="register"&&password!==confirmPassword){setError("Your passwords do not match.");return;}
    if((mode==="register"||mode==="reset")&&(password.length<12||password.length>128)){setError("Use a password between 12 and 128 characters.");return;}
    if(mode==="login"&&(!email.trim()||!password)){setError("Enter your email and password.");return;}
    setBusy(true);
    try{
      const endpoint=mode==="login"?"/api/auth/login":mode==="register"?"/api/auth/register":mode==="forgot"?"/api/auth/forgot-password":"/api/auth/reset-password";
      const body=mode==="login"||mode==="forgot"?{email:email.trim()}:mode==="register"?{name:name.trim(),email:email.trim(),password}:{token:resetToken,password};
      const r=await fetch(endpoint,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(mode==="login"||mode==="register"?{...body,password}:body)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        if(d.code==="EMAIL_NOT_VERIFIED"){setVerificationEmail(email.trim());setError(d.error||"Verify your email before signing in.");}
        else throw new Error(d.error||"Something went wrong. Please try again.");
      }else if(mode==="login"){onAuthenticated(d.user);window.history.replaceState({},"","/customer");}
      else if(mode==="register"){setVerificationEmail(email.trim());setMessage(d.message||"Check your inbox for a verification link.");}
      else if(mode==="forgot"){setMessage(d.message||"If an account exists for that email, a password reset link will be sent.");}
      else {setMessage("Your password has been updated. Sign in with your new password.");switchMode("login");}
    }catch(err){setError(err instanceof Error?err.message:"Something went wrong. Please try again.");}
    finally{setBusy(false);}
  }
  async function resendVerification(){setError("");setMessage("");setBusy(true);try{const r=await fetch("/api/auth/resend-verification",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:verificationEmail||email})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not resend verification email.");setMessage(d.message||"Check your inbox for a new verification link.");}catch(e){setError(e instanceof Error?e.message:"Could not resend email.");}finally{setBusy(false);}}
  const title=mode==="login"?"Welcome back":mode==="register"?"Create your account":mode==="forgot"?"Reset your password":"Choose a new password";
  const subtitle=mode==="login"?"Sign in to continue to your XinPay account.":mode==="register"?"A few details to get your account started.":mode==="forgot"?"We'll email you a secure password reset link.":"Choose a strong password you have not used before.";
  const passwordLabel=mode==="reset"?"New password":"Password";
  if(busy&&window.location.pathname.endsWith("/verify-email"))return <div className="xa-verifying"><div className="xa-mark">x</div><div className="xa-spinner"/><h2>Verifying your email</h2><p>Securing your XinPay account…</p></div>;
  return <div className="xa-auth">
    <section className="xa-story">
      <div className="xa-story-brand"><span className="xa-mark">x</span><span>xinpay<small>PAYMENTS MADE CLEAR</small></span></div>
      <div className="xa-story-copy"><span className="xa-eyebrow">YOUR MONEY. MORE CLARITY.</span><h1>A clearer way to stay on top of your payments.</h1><p>One place to review activity, manage payment details and keep your account organised.</p>
        <div className="xa-story-points"><div><span><ShieldCheck size={17}/></span><div><strong>Account-first security</strong><small>Email verification and protected sessions.</small></div></div><div><span><LockKeyhole size={17}/></span><div><strong>Private by default</strong><small>Your password is never stored in plain text.</small></div></div><div><span><CheckCircle2 size={17}/></span><div><strong>Clear account access</strong><small>Sign in securely across your devices.</small></div></div></div>
      </div>
      <div className="xa-story-footer">XinPay customer access <span>·</span> Secure account area</div>
      <div className="xa-orb xa-orb-one"/><div className="xa-orb xa-orb-two"/>
    </section>
    <section className="xa-form-side">
      <div className="xa-form-wrap">
        <div className="xa-mobile-brand"><span className="xa-mark">x</span><strong>xinpay</strong></div>
        <div className="xa-form-head"><span className="xa-form-icon">{mode==="forgot"||mode==="reset"?<KeyRound size={20}/>:mode==="register"?<UserRound size={20}/>:<ShieldCheck size={20}/>}</span><h2>{title}</h2><p>{subtitle}</p></div>
        {error&&<div className="xa-alert xa-error" role="alert">{error}</div>}
        {message&&<div className="xa-alert xa-success" role="status"><CheckCircle2 size={17}/><span>{message}</span></div>}
        {verified&&<div className="xa-alert xa-success"><CheckCircle2 size={17}/>Email verified successfully.</div>}
        {verificationEmail&&error.toLowerCase().includes("verify")&&<button className="xa-resend" onClick={()=>void resendVerification()} disabled={busy}>Resend verification email</button>}
        <form className="xa-form" onSubmit={submit}>
          {mode==="register"&&<label>Full name<div className="xa-input-wrap"><UserRound size={17}/><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" required minLength={2} maxLength={100}/></div></label>}
          {mode!=="reset"&&<label>Email address<div className="xa-input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254}/></div></label>}
          {(mode==="login"||mode==="register"||mode==="reset")&&<label>{passwordLabel}<div className="xa-input-wrap"><LockKeyhole size={17}/><input type={showPassword?"text":"password"} autoComplete={mode==="login"?"current-password":mode==="register"?"new-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="login"?"Enter your password":"At least 12 characters"} required minLength={mode==="login"?1:12} maxLength={128}/><button type="button" className="xa-eye" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode!=="login"&&<small className="xa-field-note">Use 12–128 characters. Avoid passwords used on other sites.</small>}</label>}
          {mode==="register"&&<label>Confirm password<div className="xa-input-wrap"><LockKeyhole size={17}/><input type={showPassword?"text":"password"} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required minLength={12} maxLength={128}/></div></label>}
          {mode==="login"&&<div className="xa-forgot-row"><button type="button" onClick={()=>switchMode("forgot")}>Forgot password?</button></div>}
          <button className="xa-submit" type="submit" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":mode==="register"?"Create account":mode==="forgot"?"Send reset link":"Update password"}<ArrowRight size={17}/></button>
        </form>
        <div className="xa-switch">{mode==="login"?<>New to XinPay? <button onClick={()=>switchMode("register")}>Create an account</button></>:mode==="register"?<>Already have an account? <button onClick={()=>switchMode("login")}>Sign in</button></>:<>Remembered your password? <button onClick={()=>switchMode("login")}>Back to sign in</button></>}</div>
        <div className="xa-legal"><ShieldCheck size={14}/> Your account is protected with encrypted password storage and secure sessions.</div>
      </div>
    </section>
  </div>;
}
