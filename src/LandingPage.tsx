import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2, LockKeyhole, ShieldCheck, WalletCards, X } from "lucide-react";
import CustomerAuth from "./CustomerAuth";
import { supabase } from "./lib/supabase";
import { toAuthUser, type AuthUser } from "./lib/auth";
import "./landing.css";

type AuthMode = "login" | "register";

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || error) return;
      const user = toAuthUser(data.session?.user || null);
      if (user) window.location.replace("/customer");
    }).catch(() => {
      // Keep the public landing page available if session restoration fails.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAuthOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [authOpen]);

  function openAuth(mode: AuthMode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function handleAuthenticated(_user: AuthUser) {
    setAuthOpen(false);
    window.location.assign("/customer");
  }

  return (
    <div className="xlp-page">
      <header className="xlp-header">
        <a className="xlp-brand" href="/" aria-label="XinPay home">
          <span className="xlp-brand-mark">x</span>
          <span>xinpay<small>PAYMENTS MADE CLEAR</small></span>
        </a>
        <nav className="xlp-header-actions" aria-label="Main navigation">
          <button className="xlp-signin" type="button" onClick={() => openAuth("login")}>Sign in</button>
          <button className="xlp-header-cta" type="button" onClick={() => openAuth("login")}>
            Get started <ArrowUpRight size={15}/>
          </button>
        </nav>
      </header>

      <main>
        <section className="xlp-hero">
          <div className="xlp-hero-glow xlp-glow-one"/>
          <div className="xlp-hero-glow xlp-glow-two"/>
          <div className="xlp-hero-inner">
            <div className="xlp-eyebrow"><span/> CUSTOMER PAYMENT EXPERIENCE</div>
            <h1>Payments, with more <em>clarity.</em></h1>
            <p className="xlp-hero-copy">A clearer place to access your XinPay account, review payment activity and stay on top of every step.</p>
            <div className="xlp-hero-actions">
              <button className="xlp-primary-cta" type="button" onClick={() => openAuth("login")}>
                Get started with XINPAY <ArrowRight size={18}/>
              </button>
              <button className="xlp-secondary-cta" type="button" onClick={() => openAuth("register")}>Create an account</button>
            </div>
            <div className="xlp-hero-meta"><ShieldCheck size={16}/> Secure account access <span/> Email verification enabled <span/> Your session, under your control</div>
          </div>
          <div className="xlp-preview-card" aria-label="XinPay customer portal preview">
            <div className="xlp-preview-top"><span className="xlp-preview-dot"/><span className="xlp-preview-dot"/><span className="xlp-preview-dot"/><small>YOUR XINPAY OVERVIEW</small></div>
            <div className="xlp-preview-content">
              <div className="xlp-preview-label">ACCOUNT ACTIVITY</div>
              <div className="xlp-preview-title">Everything in one place.</div>
              <div className="xlp-preview-stat-row">
                <div><span>Account</span><strong><CheckCircle2 size={15}/> Protected</strong></div>
                <div><span>Access</span><strong><LockKeyhole size={15}/> Verified</strong></div>
              </div>
              <div className="xlp-preview-line"><span/></div>
              <div className="xlp-preview-list"><b><WalletCards size={16}/> Customer dashboard</b><small>Transactions · Payments · Profile</small></div>
            </div>
          </div>
        </section>

        <section className="xlp-features">
          <div className="xlp-section-heading"><span>BUILT AROUND YOUR ACCOUNT</span><h2>A simpler way to stay in control.</h2><p>Sign in to manage your customer account from one place.</p></div>
          <div className="xlp-feature-grid">
            <article className="xlp-feature-card"><div className="xlp-feature-icon"><ShieldCheck size={20}/></div><h3>Protected access</h3><p>Email verification and secure sessions are handled through Supabase Auth.</p></article>
            <article className="xlp-feature-card"><div className="xlp-feature-icon"><WalletCards size={20}/></div><h3>One customer space</h3><p>Access your account overview, payment area, transaction history and profile.</p></article>
            <article className="xlp-feature-card"><div className="xlp-feature-icon"><CheckCircle2 size={20}/></div><h3>Clear account status</h3><p>Sign in with your verified account and keep control of your session.</p></article>
          </div>
        </section>
      </main>

      <footer className="xlp-footer"><a className="xlp-brand xlp-footer-brand" href="/"><span className="xlp-brand-mark">x</span><span>xinpay<small>PAYMENTS MADE CLEAR</small></span></a><p>XinPay customer access <span>·</span> Prototype environment</p><small>No live payment or bank balance activity is represented by this landing page.</small></footer>

      {authOpen && (
        <div className="xlp-auth-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAuthOpen(false);
        }}>
          <section className="xlp-auth-dialog" role="dialog" aria-modal="true" aria-label={authMode === "register" ? "Create a XinPay account" : "Sign in to XinPay"}>
            <button className="xlp-auth-close" type="button" onClick={() => setAuthOpen(false)} aria-label="Close sign in"><X size={20}/></button>
            <CustomerAuth embedded initialMode={authMode} onAuthenticated={handleAuthenticated}/>
          </section>
        </div>
      )}
    </div>
  );
}
