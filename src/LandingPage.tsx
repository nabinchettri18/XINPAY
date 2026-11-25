import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import CustomerAuth from "./CustomerAuth";
import { supabase } from "./lib/supabase";
import { toAuthUser, type AuthUser } from "./lib/auth";
import "./landing.css";

type AuthMode = "login" | "register";

export default function LandingPage() {
  const [authOpen,setAuthOpen] = useState(false);
  const [authMode,setAuthMode] = useState<AuthMode>("login");

  useEffect(()=>{
    let active=true;
    if(!supabase)return;
    void supabase.auth.getSession().then(({data,error})=>{
      if(!active||error)return;
      const user=toAuthUser(data.session?.user||null);
      if(user)window.location.replace("/customer");
    }).catch(()=>{});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(!authOpen)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setAuthOpen(false)};
    window.addEventListener("keydown",closeOnEscape);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",closeOnEscape);
    };
  },[authOpen]);

  function openAuth(mode:AuthMode="login"){
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function handleAuthenticated(_user:AuthUser){
    setAuthOpen(false);
    window.location.assign("/customer");
  }

  return <div className="xlp-page">
    <header className="xlp-header">
      <a className="xlp-brand" href="/" aria-label="XinPay home">
        <span className="xlp-brand-mark">x</span>
        <span>xinpay<small>PAYMENTS MADE CLEAR</small></span>
      </a>
      <nav className="xlp-header-actions" aria-label="Account">
        <button className="xlp-signin" type="button" onClick={()=>openAuth("login")}>Sign in</button>
        <button className="xlp-header-cta" type="button" onClick={()=>openAuth("register")}>Create account <ArrowUpRight size={15}/></button>
      </nav>
    </header>

    <main className="xlp-hero">
      <div className="xlp-hero-glow xlp-glow-one"/>
      <div className="xlp-hero-glow xlp-glow-two"/>
      <div className="xlp-hero-inner">
        <p className="xlp-eyebrow">XINPAY</p>
        <h1>Payments made <em>clear.</em></h1>
        <p className="xlp-hero-copy">Sign in to your account and keep your payment activity in view.</p>
        <div className="xlp-hero-actions">
          <button className="xlp-primary-cta" type="button" onClick={()=>openAuth("login")}>Get started with XinPay <ArrowRight size={18}/></button>
          <button className="xlp-secondary-cta" type="button" onClick={()=>openAuth("register")}>Create an account</button>
        </div>
      </div>
    </main>

    <footer className="xlp-footer">
      <a className="xlp-brand xlp-footer-brand" href="/" aria-label="XinPay home">
        <span className="xlp-brand-mark">x</span>
        <span>xinpay<small>PAYMENTS MADE CLEAR</small></span>
      </a>
      <small>© XinPay</small>
    </footer>

    {authOpen&&<div className="xlp-auth-backdrop" role="presentation" onMouseDown={event=>{
      if(event.target===event.currentTarget)setAuthOpen(false);
    }}>
      <section className="xlp-auth-dialog" role="dialog" aria-modal="true" aria-label={authMode==="register"?"Create a XinPay account":"Sign in to XinPay"}>
        <button className="xlp-auth-close" type="button" onClick={()=>setAuthOpen(false)} aria-label="Close sign in"><X size={20}/></button>
        <CustomerAuth embedded initialMode={authMode} onAuthenticated={handleAuthenticated}/>
      </section>
    </div>}
  </div>;
}
