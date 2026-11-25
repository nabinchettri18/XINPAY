import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { toAuthUser, type AuthUser } from "./lib/auth";

type Mode = "login" | "register" | "forgot" | "reset";
type Props = { onAuthenticated:(user:AuthUser)=>void };

export default function CustomerAuth({onAuthenticated}:Props) {
  const [mode,setMode] = useState<Mode>(() => window.location.pathname.endsWith("/reset-password") ? "reset" : "login");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  useEffect(()=>{
    if(!supabase)return;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="PASSWORD_RECOVERY"){
        setMode("reset");
        setError("");
        setMessage("Choose a new password for your XinPay account.");
      }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  function switchMode(next:Mode){setMode(next);setError("");setMessage("");setPassword("");setConfirmPassword("");}
  async function submit(e:FormEvent){
    e.preventDefault();setError("");setMessage("");
    if(!supabase){setError("Supabase is not configured for this deployment. Add the Supabase URL and publishable key to Vercel.");return;}
    if(mode==="register"&&(name.trim().length<2||name.trim().length>100)){setError("Enter your full name.");return;}
    if((mode==="register"||mode==="reset")&&password.length<12){setError("Use a password with at least 12 characters.");return;}
    if(password.length>128){setError("Password must be 128 characters or fewer.");return;}
    if(mode==="register"&&password!==confirmPassword){setError("Your passwords do not match.");return;}
    if(mode==="login"&&(!email.trim()||!password)){setError("Enter your email and password.");return;}
    setBusy(true);
    try{
      if(mode==="login"){
        const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error)throw error;
        const user=toAuthUser(data.user);
        if(!user)throw new Error("XinPay could not load your account. Please sign in again.");
        onAuthenticated(user);
      }else if(mode==="register"){
        const {data,error}=await supabase.auth.signUp({
          email:email.trim(),
          password,
          options:{
            data:{full_name:name.trim()},
            emailRedirectTo:window.location.origin+"/customer",
          },
        });
        if(error)throw error;
        if(data.session&&data.user){
          const user=toAuthUser(data.user);
          if(user)onAuthenticated(user);
        }else{
          setMode("login");
          setPassword("");
          setConfirmPassword("");
          setMessage("Account created. Check your inbox for the email confirmation link before signing in.");
        }
      }else if(mode==="forgot"){
        const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{
          redirectTo:window.location.origin+"/customer/reset-password",
        });
        if(error)throw error;
        setMode("login");
        setMessage("If an account exists for that email, a password reset link will be sent.");
      }else{
        const {error}=await supabase.auth.updateUser({password});
        if(error)throw error;
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        setMessage("Your password has been updated. You can continue with your account.");
      }
    }catch(err){
      const text=err instanceof Error?err.message:"Something went wrong. Please try again.";
      setError(text.includes("Email not confirmed")?"Verify your email address before signing in.":text);
    }finally{setBusy(false);}
  }

  async function resendConfirmation(){
    if(!supabase||!email.trim())return;
    setError("");setMessage("");setBusy(true);
    try{
      const {error}=await supabase.auth.resend({
        type:"signup",
        email:email.trim(),
        options:{emailRedirectTo:window.location.origin+"/customer"},
      });
      if(error)throw error;
      setMessage("A new confirmation email has been requested. Check your inbox.");
    }catch(err){setError(err instanceof Error?err.message:"Could not resend confirmation email.");}
    finally{setBusy(false);}
  }

  const title=mode==="login"?"Welcome back":mode==="register"?"Create your account":mode==="forgot"?"Reset your password":"Choose a new password";
  const subtitle=mode==="login"?"Sign in to continue to your XinPay account.":mode==="register"?"A few details to get your account started.":mode==="forgot"?"We'll email you a secure password reset link.":"Choose a strong password you have not used before.";

  if(!isSupabaseConfigured)return <div className="xa-verifying"><div className="xa-mark">x</div><h2>XinPay authentication is not configured</h2><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to this Vercel project.</p></div>;

  return <div className="xa-auth">
    <section className="xa-story">
      <div className="xa-story-brand"><span className="xa-mark">x</span><span>xinpay<small>PAYMENTS MADE CLEAR</small></span></div>
      <div className="xa-story-copy"><span className="xa-eyebrow">YOUR MONEY. MORE CLARITY.</span><h1>A clearer way to stay on top of your payments.</h1><p>One place to review activity, manage payment details and keep your account organised.</p>
        <div className="xa-story-points"><div><span><ShieldCheck size={17}/></span><div><strong>Account-first security</strong><small>Email verification and protected sessions.</small></div></div><div><span><LockKeyhole size={17}/></span><div><strong>Private by default</strong><small>Secure authentication managed by Supabase.</small></div></div><div><span><CheckCircle2 size={17}/></span><div><strong>Clear account access</strong><small>Sign in securely across your devices.</small></div></div></div>
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
        {error.toLowerCase().includes("verify your email")&&<button className="xa-resend" onClick={()=>void resendConfirmation()} disabled={busy}>Resend confirmation email</button>}
        <form className="xa-form" onSubmit={submit}>
          {mode==="register"&&<label>Full name<div className="xa-input-wrap"><UserRound size={17}/><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" required minLength={2} maxLength={100}/></div></label>}
          {mode!=="reset"&&<label>Email address<div className="xa-input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254}/></div></label>}
          {(mode==="login"||mode==="register"||mode==="reset")&&<label>{mode==="reset"?"New password":"Password"}<div className="xa-input-wrap"><LockKeyhole size={17}/><input type={showPassword?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="login"?"Enter your password":"At least 12 characters"} required minLength={mode==="login"?1:12} maxLength={128}/><button type="button" className="xa-eye" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode!=="login"&&<small className="xa-field-note">Use 12–128 characters. Avoid passwords used on other sites.</small>}</label>}
          {mode==="register"&&<label>Confirm password<div className="xa-input-wrap"><LockKeyhole size={17}/><input type={showPassword?"text":"password"} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required minLength={12} maxLength={128}/></div></label>}
          {mode==="login"&&<div className="xa-forgot-row"><button type="button" onClick={()=>switchMode("forgot")}>Forgot password?</button></div>}
          <button className="xa-submit" type="submit" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":mode==="register"?"Create account":mode==="forgot"?"Send reset link":"Update password"}<ArrowRight size={17}/></button>
        </form>
        <div className="xa-switch">{mode==="login"?<>New to XinPay? <button onClick={()=>switchMode("register")}>Create an account</button></>:mode==="register"?<>Already have an account? <button onClick={()=>switchMode("login")}>Sign in</button></>:<>Remembered your password? <button onClick={()=>switchMode("login")}>Back to sign in</button></>}</div>
        <div className="xa-legal"><ShieldCheck size={14}/> Your authentication is handled securely by Supabase.</div>
      </div>
    </section>
  </div>;
}
