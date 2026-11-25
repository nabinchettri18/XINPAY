import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CustomerApp from "./CustomerApp";
import ProofReview from "./ProofReview";
import AdminWithdrawals from "./AdminWithdrawals";
import AdminWalletTopups from "./AdminWalletTopups";
import { supabase } from "./paymentConfig";
import "./styles.css";
import "./customer.css";

const path = window.location.pathname;
const isCustomer = path.startsWith("/customer");
const isProofReview = path.startsWith("/admin/proofs");
const isWithdrawals = path.startsWith("/admin/withdrawals");
const isWalletTopups = path.startsWith("/admin/topups");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isCustomer ? <CustomerApp /> : isProofReview ? <AdminAuth><ProofReview /></AdminAuth> : isWithdrawals ? <AdminAuth><AdminWithdrawals /></AdminAuth> : isWalletTopups ? <AdminAuth><AdminWalletTopups /></AdminAuth> : <AdminAuth><App /></AdminAuth>}
  </React.StrictMode>
);

function AdminAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => setSession(currentSession));
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="xp-auth-loading"><div className="xp-loading-mark">X</div><span>Securing your admin workspace…</span></div>;
  if (session) return <>{children}</>;

  return (
    <main className="xp-login-page">
      <section className="xp-login-layout">
        <aside className="xp-login-aside">
          <div className="xp-login-logo"><span className="xp-logo-square">X</span><span className="xp-logo-type">xinpay<small>PAYMENT OPERATIONS</small></span></div>
          <div className="xp-aside-content">
            <span className="xp-kicker">ADMINISTRATOR ACCESS</span>
            <h2>Everything in your payment operation, <em>under control.</em></h2>
            <p>Access your workspace to review activity, manage payment settings and oversee customer operations.</p>
            <div className="xp-login-feature"><span>01</span><div><strong>Operational overview</strong><small>Activity and account management</small></div></div>
            <div className="xp-login-feature"><span>02</span><div><strong>Protected workspace</strong><small>Authorized administrator access only</small></div></div>
          </div>
          <div className="xp-aside-footer"><span className="xp-security-dot"/> Secure administrator portal <span>•</span> XinPay</div>
        </aside>
        <section className="xp-login-main">
          <form className="xp-login-form" onSubmit={async e => {
            e.preventDefault(); setError(""); setSubmitting(true);
            const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (authError) setError(authError.message);
            setSubmitting(false);
          }}>
            <div className="xp-mobile-brand"><span className="xp-logo-square"><span className="xp-logo-glyph">x</span></span><span className="xp-logo-type">xinpay<small>PAYMENT OPERATIONS</small></span><span className="xp-brand-badge">ADMIN</span></div>
            <div className="xp-form-eyebrow">WELCOME BACK</div>
            <h1>Sign in to XinPay</h1>
            <p className="xp-form-intro">Enter your administrator credentials to continue.</p>
            <label className="xp-field">Email address<input type="email" autoComplete="username" placeholder="admin@yourcompany.com" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <label className="xp-field">Password<div className="xp-password-wrap"><input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={e=>setPassword(e.target.value)}/><button className="xp-password-toggle" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>
            <button className="xp-login-submit" type="submit" disabled={submitting}>{submitting ? "Authenticating…" : "Sign in to workspace"}<span>→</span></button>
            {error && <div className="xp-login-error" role="alert">{error}</div>}
            <div className="xp-login-note"><span className="xp-note-icon">⌑</span><span>Access is restricted to authorized XinPay administrators.</span></div>
            <div className="xp-login-bottom">Protected by Supabase authentication <span>•</span> No public registration</div>
          </form>
        </section>
      </section>
    </main>
  );
}
