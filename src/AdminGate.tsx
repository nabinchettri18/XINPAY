import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { apiUrl } from "./lib/api";
import "./admin-auth.css";

type Phase = "loading" | "signed-out" | "checking" | "authorized" | "denied";
type Props = { children: ReactNode };

export default function AdminGate({ children }: Props) {
  const [phase,setPhase] = useState<Phase>("loading");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [adminEmail,setAdminEmail] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  async function verifyAccessToken(token: string) {
    setPhase("checking");
    setError("");
    try {
      const response = await fetch(apiUrl("/api/admin/session"), {
        method: "GET",
        headers: { Accept: "application/json", Authorization: "Bearer " + token },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAdminEmail("");
        setPhase("denied");
        setError(response.status === 401 || response.status === 403
          ? "This account is signed in but is not authorised for the XinPay admin console."
          : data.error || "XinPay could not verify your administrator access.");
        return false;
      }
      setAdminEmail(String(data.email || ""));
      setPhase("authorized");
      return true;
    } catch {
      setPhase("denied");
      setError("Could not reach the secure XinPay API. Check the Vercel API deployment.");
      return false;
    }
  }

  useEffect(() => {
    if (!supabase) {
      setPhase("signed-out");
      setError("Supabase authentication is not configured for this deployment.");
      return;
    }
    let active = true;
    let checkId = 0;
    const check = async (token: string | null) => {
      const current = ++checkId;
      if (!token) {
        if (active) { setAdminEmail(""); setPhase("signed-out"); }
        return;
      }
      if (active) setPhase("checking");
      try {
        const response = await fetch(apiUrl("/api/admin/session"), {
          headers: { Accept: "application/json", Authorization: "Bearer " + token },
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!active || current !== checkId) return;
        if (response.ok) {
          setAdminEmail(String(data.email || ""));
          setError("");
          setPhase("authorized");
        } else {
          setAdminEmail("");
          setError(response.status === 401 || response.status === 403
            ? "This account is not on the XinPay administrator allowlist. Customer access does not grant admin permissions."
            : data.error || "XinPay could not verify administrator access.");
          setPhase("denied");
        }
      } catch {
        if (active && current === checkId) {
          setError("Could not reach the secure XinPay API. Check the Vercel API deployment.");
          setPhase("denied");
        }
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void check(session?.access_token || null);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        if (active) { setError(sessionError.message); setPhase("signed-out"); }
        return;
      }
      void check(data.session?.access_token || null);
    });
    return () => { active = false; checkId++; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      if (!data.session?.access_token) throw new Error("No active sign-in session was returned.");
      setPassword("");
      await verifyAccessToken(data.session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setPhase("signed-out");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setPassword("");
    setAdminEmail("");
    setError("");
    setPhase("signed-out");
  }

  if (phase === "authorized") return <>{children}</>;
  if (phase === "loading" || phase === "checking") {
    return <div className="xpa-screen"><div className="xpa-card xpa-loading"><span className="xpa-logo">x</span><ShieldCheck size={22}/><h1>Verifying admin access</h1><p>Checking your XinPay session with the secure payment API.</p></div></div>;
  }

  return <div className="xpa-screen">
    <section className="xpa-card">
      <div className="xpa-brand"><span className="xpa-logo">x</span><span>xinpay<small>ADMIN CONSOLE</small></span></div>
      <div className="xpa-heading-icon"><LockKeyhole size={21}/></div>
      <p className="xpa-eyebrow">RESTRICTED WORKSPACE</p>
      <h1>{phase === "denied" ? "Admin access required" : "Sign in to XinPay"}</h1>
      <p className="xpa-intro">Use your existing XinPay administrator account. Admin access is checked server-side and is separate from customer registration.</p>
      {error && <div className="xpa-error" role="alert">{error}</div>}
      {phase === "denied" && adminEmail && <p className="xpa-account-label">Signed in as {adminEmail}</p>}
      {phase !== "denied" && isSupabaseConfigured && <form onSubmit={submit} className="xpa-form">
        <label>Email address<span className="xpa-input"><Mail size={17}/><input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="admin@example.com"/></span></label>
        <label>Password<span className="xpa-input"><KeyRound size={17}/><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password"/></span></label>
        <button type="submit" disabled={busy}>{busy?"Signing in…":"Sign in securely"}<ArrowRight size={17}/></button>
      </form>}
      {phase === "denied" && <button className="xpa-secondary" onClick={()=>void signOut()}>Use another account</button>}
      {!isSupabaseConfigured && <p className="xpa-help">Add the existing Supabase URL and publishable key to the Vercel project environment before signing in.</p>}
      <div className="xpa-foot"><ShieldCheck size={15}/> Supabase authenticates the user. The Worker independently verifies the JWT and admin email allowlist.</div>
    </section>
  </div>;
}
