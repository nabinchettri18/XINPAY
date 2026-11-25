import { useEffect, useState } from "react";
import CustomerAuth from "./CustomerAuth";
import SubscriptionWorkspace from "./SubscriptionWorkspace";
import { supabase } from "./lib/supabase";
import { toAuthUser, type AuthUser } from "./lib/auth";

export default function CustomerApp() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthUser(toAuthUser(session?.user || null));
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setAuthUser(error ? null : toAuthUser(data.session?.user || null));
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active) { setAuthUser(null); setAuthLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
  }

  const isPasswordRecoveryRoute = window.location.pathname.endsWith("/reset-password");
  if (authLoading) return <div className="xa-loading">Loading your account…</div>;
  if (!authUser || isPasswordRecoveryRoute) {
    return <CustomerAuth onAuthenticated={(user) => {
      setAuthUser(user);
      if (isPasswordRecoveryRoute) window.history.replaceState({}, "", "/customer");
    }} />;
  }

  return <SubscriptionWorkspace authUser={authUser} onSignOut={() => void signOut()} />;
}
