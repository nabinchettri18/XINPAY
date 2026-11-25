import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2,
  ChevronRight, Clock3, Copy, CreditCard, Home, LogOut, Menu, Plus,
  Search, Settings, ShieldCheck, Wallet, X
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import CustomerAuth from "./CustomerAuth";
import { supabase } from "./lib/supabase";
import { apiFetch } from "./lib/api";
import { toAuthUser, type AuthUser } from "./lib/auth";
import { loadPaymentConfig, subscribePaymentConfig } from "./paymentConfig";

type Section = "Overview" | "Transactions" | "Payments" | "Profile";
type OrderStatus = "Completed" | "Pending" | "In review" | "Failed";
type CustomerOrder = {
  id: string;
  purpose: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  provider: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};
const nav: { name: Section; icon: typeof Home }[] = [
  { name: "Overview", icon: Home },
  { name: "Transactions", icon: Activity },
  { name: "Payments", icon: ArrowUpRight },
  { name: "Profile", icon: Settings },
];
const money = (n: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(n);

function displayStatus(status: string): OrderStatus {
  if (status === "paid") return "Completed";
  if (status === "review") return "In review";
  if (status === "failed" || status === "expired" || status === "cancelled") return "Failed";
  return "Pending";
}
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
}
function makeOrder(data: any, purpose = "Payment request"): CustomerOrder {
  return {
    id: String(data.orderId || data.id || ""),
    purpose: String(data.purpose || purpose),
    amount: Number(data.amount || 0),
    currency: String(data.currency || "INR"),
    status: displayStatus(String(data.status || "pending")),
    provider: String(data.provider || "payment"),
    createdAt: String(data.createdAt || new Date().toISOString()),
    updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
    expiresAt: data.expiresAt ? String(data.expiresAt) : null,
  };
}

export default function CustomerApp() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [section, setSection] = useState<Section>("Overview");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<CustomerOrder | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [paymentConfig, setPaymentConfig] = useState({ upiId: "", beneficiary: "", instructions: "", enabled: false });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPurpose, setPaymentPurpose] = useState("");
  const [paymentStep, setPaymentStep] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [directOrder, setDirectOrder] = useState<any>(null);
  const [returnStatus, setReturnStatus] = useState("");

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

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError("");
    void apiFetch("/api/customer/orders", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load payment activity.");
        const rows = Array.isArray(data.orders) ? data.orders : [];
        if (!cancelled) setOrders(rows.map((row: any) => makeOrder(row)));
      })
      .catch((error) => {
        if (!cancelled) setOrdersError(error instanceof Error ? error.message : "Could not load payment activity.");
      })
      .finally(() => { if (!cancelled) setOrdersLoading(false); });
    return () => { cancelled = true; };
  }, [authUser?.id]);

  useEffect(() => {
    const refresh = () => loadPaymentConfig().then(setPaymentConfig).catch(() => undefined);
    void refresh();
    return subscribePaymentConfig(refresh);
  }, []);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) return;
    const token = sessionStorage.getItem("xinpay_order_token:" + orderId);
    if (!token) { setReturnStatus("Payment is awaiting provider confirmation."); return; }
    let cancelled = false;
    void apiFetch("/api/orders/" + encodeURIComponent(orderId), {
      headers: { "X-Order-Token": token }, cache: "no-store",
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not verify this payment.");
      if (!cancelled) setReturnStatus("Payment " + displayStatus(String(data.status)) + " · " + orderId);
    }).catch(() => {
      if (!cancelled) setReturnStatus("Payment status is not available yet. Check transactions again shortly.");
    });
    return () => { cancelled = true; };
  }, []);

  const upiId = paymentConfig.upiId;
  const upiName = paymentConfig.beneficiary;
  const validUpi = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim());
  const validAmount = /^\d{1,8}(\.\d{1,2})?$/.test(paymentAmount) && Number(paymentAmount) > 0;
  const upiUri = useMemo(() => `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(paymentAmount)}&cu=INR&tn=${encodeURIComponent(paymentPurpose)}`, [upiId, upiName, paymentAmount, paymentPurpose]);
  const filtered = useMemo(() => orders.filter((order) =>
    (filter === "All" || order.status === filter) &&
    (order.id + " " + order.purpose + " " + order.provider).toLowerCase().includes(search.toLowerCase())
  ), [orders, filter, search]);
  const completedCount = orders.filter((order) => order.status === "Completed").length;
  const pendingCount = orders.filter((order) => order.status === "Pending" || order.status === "In review").length;
  const customerInitials = (authUser?.name || "Customer").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };
  const go = (next: Section) => {
    setSection(next); setMobileNav(false); setSearch(""); setFilter("All");
    if (next !== "Payments") { setCheckoutError(""); setPaymentStep(0); setDirectOrder(null); }
  };
  const addCreatedOrder = (data: any, fallbackPurpose: string) => {
    const order = makeOrder({ ...data, purpose: fallbackPurpose });
    if (order.id) setOrders((previous) => [order, ...previous.filter((item) => item.id !== order.id)]);
  };

  async function startCashfreeCheckout() {
    setCheckoutBusy(true); setCheckoutError("");
    try {
      const response = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amount: Number(paymentAmount), purpose: paymentPurpose || "XinPay payment" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Checkout is currently unavailable.");
      if (data.orderId && data.orderToken) sessionStorage.setItem("xinpay_order_token:" + data.orderId, data.orderToken);
      addCreatedOrder(data, paymentPurpose || "XinPay payment");
      if (!data.paymentSessionId) throw new Error("Payment session is not available.");
      const win = window as any;
      if (!win.Cashfree) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Could not load checkout."));
          document.head.appendChild(script);
        });
      }
      await win.Cashfree({ mode: "sandbox" }).checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally { setCheckoutBusy(false); }
  }

  async function startDirectUpi() {
    setCheckoutBusy(true); setCheckoutError("");
    try {
      const response = await apiFetch("/api/direct-upi/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amount: Number(paymentAmount), purpose: paymentPurpose || "XinPay payment" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "UPI payment is currently unavailable.");
      if (data.orderId && data.orderToken) sessionStorage.setItem("xinpay_order_token:" + data.orderId, data.orderToken);
      addCreatedOrder(data, paymentPurpose || "XinPay payment");
      setDirectOrder(data);
      setPaymentStep(1);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to create UPI request.");
    } finally { setCheckoutBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) { showToast(error.message); return; }
    setAuthUser(null);
  }

  const isPasswordRecoveryRoute = window.location.pathname.endsWith("/reset-password");
  if (authLoading) return <div className="xa-loading">Loading your account…</div>;
  if (!authUser || isPasswordRecoveryRoute) return <CustomerAuth onAuthenticated={(user) => {
    setAuthUser(user);
    if (isPasswordRecoveryRoute) window.history.replaceState({}, "", "/customer");
  }} />;

  return <div className="xp-shell">
    <aside className="xp-sidebar">
      <a className="xp-brand" href="/customer" aria-label="XinPay customer overview">
        <span className="xp-brand-mark">x</span><span className="xp-brand-word">xinpay<small>PAYMENTS MADE CLEAR</small></span>
      </a>
      <div className="xp-account">
        <div className="xp-avatar">{customerInitials}</div>
        <div className="xp-account-text"><strong>{authUser.name}</strong><small>{authUser.email}</small></div>
      </div>
      <div className="xp-nav-label">ACCOUNT</div>
      <nav>{nav.map(({ name, icon: Icon }) => <button key={name} className={section === name ? "xp-nav active" : "xp-nav"} onClick={() => go(name)}><Icon size={18}/><span>{name}</span></button>)}</nav>
      <div className="xp-sidebar-bottom"><button className="xp-signout" onClick={() => void signOut()}><LogOut size={16}/> Sign out</button></div>
    </aside>

    <main className="xp-main">
      <header className="xp-topbar">
        <button className="xp-mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={19}/></button>
        <div className="xp-breadcrumb"><span>Account</span><ChevronRight size={14}/><strong>{section}</strong></div>
        <div className="xp-top-actions"><div className="xp-avatar small">{customerInitials}</div><button className="xp-header-signout" onClick={() => void signOut()}><LogOut size={15}/> Sign out</button></div>
      </header>

      {mobileNav && <div className="xp-mobile-drawer">{nav.map(({ name, icon: Icon }) => <button key={name} onClick={() => go(name)} className={section === name ? "active" : ""}><Icon size={18}/>{name}</button>)}</div>}

      <div className="xp-content">
        {returnStatus && <div className="xc-status-banner"><CheckCircle2 size={17}/><span>{returnStatus}</span><button onClick={() => { setReturnStatus(""); const url = new URL(window.location.href); url.searchParams.delete("order_id"); window.history.replaceState({}, "", url.toString()); }} aria-label="Dismiss"><X size={16}/></button></div>}
        {ordersError && <div className="xc-error-banner"><span>{ordersError}</span><button onClick={() => window.location.reload()}>Retry</button></div>}

        {section === "Overview" && <>
          <div className="xc-welcome">
            <div><p className="xp-eyebrow">YOUR ACCOUNT</p><h1>Welcome back, {authUser.name.split(/\s+/)[0]}</h1><p>Your payment activity, in one place.</p></div>
            <button className="xc-primary" onClick={() => go("Payments")}><Plus size={17}/> New payment</button>
          </div>
          <div className="xc-stats">
            <section className="xc-stat-card"><span>Total requests</span><strong>{ordersLoading ? "—" : orders.length}</strong><small>Payment requests</small></section>
            <section className="xc-stat-card"><span>Completed</span><strong>{ordersLoading ? "—" : completedCount}</strong><small>Confirmed payments</small></section>
            <section className="xc-stat-card"><span>Awaiting confirmation</span><strong>{ordersLoading ? "—" : pendingCount}</strong><small>Pending or in review</small></section>
          </div>
          <div className="xc-overview-grid">
            <section className="xc-panel">
              <div className="xc-panel-heading"><div><h2>Recent payments</h2><p>Your latest payment requests</p></div><button className="xc-link" onClick={() => go("Transactions")}>View all <ChevronRight size={15}/></button></div>
              {ordersLoading ? <div className="xc-empty">Loading payment activity…</div> :
                orders.length ? <OrderList orders={orders.slice(0, 5)} onSelect={setSelected}/> :
                  <div className="xc-empty"><div className="xc-empty-icon"><Activity size={20}/></div><strong>No payment requests yet</strong><span>Your payment history will appear here.</span><button onClick={() => go("Payments")}>Create a payment request <ArrowRight size={15}/></button></div>}
            </section>
            <section className="xc-panel xc-shortcut-panel">
              <span className="xp-eyebrow">PAYMENTS</span><h2>Make a request</h2><p>Enter an amount and reference to start a payment.</p>
              <button className="xc-primary" onClick={() => go("Payments")}>Continue <ArrowRight size={16}/></button>
              <div className="xc-shortcut-foot"><ShieldCheck size={16}/><span>Payment status updates when confirmed by the payment provider or reconciled by the recipient.</span></div>
            </section>
          </div>
        </>}

        {section === "Transactions" && <>
          <div className="xc-welcome"><div><p className="xp-eyebrow">ACCOUNT ACTIVITY</p><h1>Transactions</h1><p>Search your payment requests and check their status.</p></div></div>
          <section className="xc-panel">
            <div className="xc-transaction-tools">
              <label className="xc-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by purpose or ID"/></label>
              <div className="xc-filters">{["All", "Completed", "Pending", "In review", "Failed"].map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div>
            </div>
            {ordersLoading ? <div className="xc-empty">Loading payment activity…</div> :
              filtered.length ? <OrderList orders={filtered} onSelect={setSelected}/> :
                <div className="xc-empty"><strong>No matching payments</strong><span>Try another search or status filter.</span></div>}
          </section>
        </>}

        {section === "Payments" && <>
          <div className="xc-welcome"><div><p className="xp-eyebrow">PAYMENT REQUEST</p><h1>Create a payment</h1><p>Choose an amount and add a reference.</p></div></div>
          <section className="xc-panel xc-payment-panel">
            {paymentStep === 0 ? <>
              <div className="xc-form">
                <label>Amount (INR)<span className="xc-amount-input"><b>₹</b><input value={paymentAmount} onChange={(event) => { const value = event.target.value; if (value === "" || /^\d{0,8}(\.\d{0,2})?$/.test(value)) setPaymentAmount(value); }} inputMode="decimal" placeholder="0.00"/></span></label>
                <label>Payment reference <input value={paymentPurpose} onChange={(event) => setPaymentPurpose(event.target.value)} maxLength={80} placeholder="What is this payment for?"/></label>
                {checkoutError && <div className="xc-error-banner">{checkoutError}</div>}
                <div className="xc-payment-actions">
                  <button className="xc-primary" disabled={!validAmount || checkoutBusy} onClick={() => void startCashfreeCheckout()}>{checkoutBusy ? "Opening checkout…" : "Continue with Cashfree"} <ArrowRight size={16}/></button>
                  <button className="xc-secondary" disabled={!validAmount || checkoutBusy} onClick={() => void startDirectUpi()}>Create UPI QR</button>
                </div>
                <p className="xc-safety-note">Never share your UPI PIN or OTP. A UPI QR scan alone does not confirm payment.</p>
              </div>
            </> : <div className="xc-qr-result">
              <div className="xc-qr-code"><QRCodeSVG value={directOrder?.upiUri || ""} size={176} level="M" includeMargin bgColor="#ffffff" fgColor="#173B35"/></div>
              <div><h2>{money(Number(paymentAmount))}</h2><p>{paymentPurpose || "Payment request"}</p><strong className="xc-order-pending"><Clock3 size={15}/> Awaiting confirmation</strong><div className="xc-upi-line"><span>{directOrder?.upiId}</span><button onClick={() => { void navigator.clipboard?.writeText(directOrder?.upiId || ""); showToast("UPI ID copied"); }}><Copy size={15}/> Copy</button></div><a className="xc-secondary xc-upi-open" href={directOrder?.upiUri || upiUri}>Open UPI app</a><button className="xc-text-button" onClick={() => { setDirectOrder(null); setPaymentStep(0); }}>Create another request</button></div>
              <p className="xc-safety-note">The payment is marked complete only after the receiving bank credit is reconciled.</p>
            </div>}
          </section>
        </>}

        {section === "Profile" && <>
          <div className="xc-welcome"><div><p className="xp-eyebrow">ACCOUNT</p><h1>Your profile</h1><p>Account information associated with this sign-in.</p></div></div>
          <section className="xc-panel xc-profile-panel">
            <div className="xc-profile-head"><div className="xp-avatar large">{customerInitials}</div><div><strong>{authUser.name}</strong><span>{authUser.email}</span></div></div>
            <div className="xc-profile-row"><span>Full name</span><strong>{authUser.name}</strong></div>
            <div className="xc-profile-row"><span>Email address</span><strong>{authUser.email}</strong></div>
            <div className="xc-profile-row"><span>Customer ID</span><strong>{authUser.id}</strong></div>
            <button className="xc-secondary xc-signout" onClick={() => void signOut()}><LogOut size={16}/> Sign out</button>
          </section>
        </>}
      </div>
    </main>

    {selected && <div className="xp-modal-backdrop" onClick={() => setSelected(null)}><div className="xp-transaction-modal xc-order-modal" onClick={(event) => event.stopPropagation()}>
      <div className="xp-modal-head"><strong>Payment details</strong><button onClick={() => setSelected(null)} aria-label="Close details"><X size={18}/></button></div>
      <div className="xc-order-modal-amount"><h2>{money(selected.amount)}</h2><span className={"xc-status-pill " + selected.status.toLowerCase().replace(" ", "-")}>{selected.status}</span><p>{selected.purpose}</p></div>
      <div className="xc-profile-row"><span>Request ID</span><strong>{selected.id}</strong></div>
      <div className="xc-profile-row"><span>Created</span><strong>{dateLabel(selected.createdAt)}</strong></div>
      <div className="xc-profile-row"><span>Method</span><strong>{selected.provider.replace(/_/g, " ")}</strong></div>
      <div className="xc-profile-row"><span>Updated</span><strong>{dateLabel(selected.updatedAt)}</strong></div>
    </div></div>}
    {toast && <div className="xp-toast">{toast}</div>}
  </div>;
}

function OrderList({ orders, onSelect }: { orders: CustomerOrder[]; onSelect: (order: CustomerOrder) => void }) {
  if (!orders.length) return <div className="xc-empty"><strong>No payment requests</strong><span>New payment requests will appear here.</span></div>;
  return <div className="xc-order-list">{orders.map((order) => <button className="xc-order-row" key={order.id} onClick={() => onSelect(order)}>
    <span className="xc-order-icon">{order.status === "Completed" ? <CheckCircle2 size={18}/> : order.status === "Failed" ? <X size={18}/> : <Clock3 size={18}/>}</span>
    <span className="xc-order-copy"><strong>{order.purpose}</strong><small>{order.id} · {dateLabel(order.createdAt)}</small></span>
    <span className="xc-order-amount"><strong>{money(order.amount)}</strong><small className={"xc-status-pill " + order.status.toLowerCase().replace(" ", "-")}>{order.status}</small></span>
    <ChevronRight className="xc-order-chevron" size={16}/>
  </button>)}</div>;
}
