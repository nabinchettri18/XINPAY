import { useEffect, useState } from "react";
import { apiFetch } from "./lib/api";
import { supabase } from "./lib/supabase";
import PaymentSettings from "./PaymentSettings";
import AdminTransactions from "./AdminTransactions";
import AdminSubscriptionRequests from "./AdminSubscriptionRequests";
import AdminBankAccounts from "./AdminBankAccounts";
import AdminCustomers from "./AdminCustomers";
import AdminSettlements from "./AdminSettlements";
import {
  Activity, AlertCircle, ArrowLeftRight, Bell, Building2, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, CreditCard, LayoutDashboard,
  Menu, RefreshCw, ReceiptText, Settings, ShieldCheck, Wallet, LogOut
} from "lucide-react";

type NavKey = "Overview" | "Transactions" | "Subscription Requests" | "Settlements" | "Accounts" | "Customers" | "Support" | "Payment Settings" | "Settings";
const navItems: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Transactions", icon: Activity },
  { label: "Subscription Requests", icon: ShieldCheck },
  { label: "Settlements", icon: Wallet },
  { label: "Accounts", icon: Building2 },
  { label: "Customers", icon: CreditCard },
  { label: "Support", icon: CircleHelp },
  { label: "Payment Settings", icon: Settings },
  { label: "Settings", icon: Settings }
];
const quickActions: { label: string; description: string; icon: typeof Activity; target: NavKey }[] = [
  { label: "Subscription requests", description: "Review proofs and UTRs", icon: ShieldCheck, target: "Subscription Requests" },
  { label: "Transactions", description: "View payment orders", icon: ReceiptText, target: "Transactions" },
  { label: "Payment settings", description: "Change UPI ID and QR", icon: Settings, target: "Payment Settings" },
  { label: "Reconciliation", description: "Verify matching bank credits", icon: RefreshCw, target: "Transactions" }
];
type Order = { id: string; provider: string; purpose: string; amount_minor: number; currency: string; status: string; created_at: string };

export default function App() {
  const [active, setActive] = useState<NavKey>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = (section: NavKey) => { setActive(section); setMobileOpen(false); };
  return <div className="app-shell">
    <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><div className="brand-mark">X</div><div><strong>xinpay</strong><small>PAYMENT OPERATIONS</small></div></div>
      <div className="workspace"><span className="workspace-icon">XP</span><div><strong>XinPay Admin</strong><small>Secure operations</small></div><ChevronDown size={16}/></div>
      <p className="nav-label">WORKSPACE</p>
      <nav>{navItems.map(({label,icon:Icon})=><button key={label} className={active===label?"nav-item active":"nav-item"} onClick={()=>go(label)}><Icon size={18}/><span>{label}</span>{label==="Subscription Requests"&&<span className="nav-count">Review</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17}/><span><strong>Secure admin session</strong><small>Verified server-side access</small></span></div><div className="profile"><div className="avatar">AD</div><div><strong>Administrator</strong><small>Authorised account</small></div><ChevronDown size={16}/></div></div>
    </aside>
    {mobileOpen&&<button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu/></button><div className="breadcrumbs">Workspace <span>/</span> <strong>{active}</strong></div><div className="top-actions"><button className="icon-btn notification" aria-label="Notifications not connected" title="Notifications are not connected" disabled><Bell size={18}/></button><button className="admin-signout" onClick={()=>void supabase?.auth.signOut()} title="Sign out"><LogOut size={16}/><span>Sign out</span></button><div className="avatar small">AD</div></div></header>
      <div className="page-content">
        <div className="overview-welcome"><div><p className="eyebrow">PAYMENT OPERATIONS · WORKSPACE</p><h1>{active==="Overview"?"XinPay operations":active}</h1><p className="subheading">{active==="Overview"?"Monitor subscription payments, manual reviews, and payment configuration.":"Manage customer plan payments and payment operations."}</p></div>{active==="Overview"&&<div className="welcome-actions"><button className="welcome-secondary" onClick={()=>go("Subscription Requests")}><ShieldCheck size={15}/> Review requests</button><button className="welcome-primary" onClick={()=>go("Payment Settings")}><Settings size={15}/> Payment settings</button></div>}</div>
        {active==="Overview"?<Overview onNavigate={go}/>:active==="Payment Settings"?<PaymentSettings/>:active==="Transactions"?<AdminTransactions/>:active==="Subscription Requests"?<AdminSubscriptionRequests/>:active==="Accounts"?<AdminBankAccounts/>:active==="Customers"?<AdminCustomers/>:active==="Settlements"?<AdminSettlements/>:<section className="panel section-panel"><div className="empty-icon">{(()=>{const I=navItems.find(n=>n.label===active)?.icon||LayoutDashboard;return <I size={24}/>})()}</div><h2>{active}</h2><p>This module is not connected to live records yet.</p><div className="module-list"><span>✓ Workspace navigation</span><span>○ Backend integration pending</span><span>○ Audit and permissions pending</span></div></section>}
        <footer>XinPay Admin <span>•</span> Payment operations workspace</footer>
      </div>
    </main>
  </div>;
}

function Metric({title,value,detail,icon:Icon}:{title:string;value:string;detail:string;icon:any}) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={18}/></div></div><strong className="metric-value">{value}</strong><div className="metric-bottom"><span>{detail}</span></div></div>;
}

function Overview({onNavigate}:{onNavigate:(section:NavKey)=>void}) {
  const [orders,setOrders]=useState<Order[]>([]);
  const [requests,setRequests]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  async function load(){
    setLoading(true);setError("");
    try{
      const [orderRes,requestRes]=await Promise.all([
        apiFetch("/api/admin/orders",{cache:"no-store"}),
        apiFetch("/api/admin/subscription-requests",{cache:"no-store"})
      ]);
      const orderData=await orderRes.json().catch(()=>({}));
      const requestData=await requestRes.json().catch(()=>({}));
      if(!orderRes.ok)throw new Error(orderData.error||"Could not load payment orders.");
      if(!requestRes.ok)throw new Error(requestData.error||"Could not load subscription requests.");
      setOrders(Array.isArray(orderData.orders)?orderData.orders:[]);
      setRequests(Array.isArray(requestData.requests)?requestData.requests:[]);
    }catch(err){setError(err instanceof Error?err.message:"Live dashboard data unavailable.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load()},[]);
  const money=(minor:number,currency="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:2}).format((minor||0)/100);
  const paid=orders.filter(o=>["paid","completed","success","succeeded"].includes((o.status||"").toLowerCase()));
  const pending=orders.filter(o=>["pending","review","awaiting_payment","submitted","processing"].includes((o.status||"").toLowerCase()));
  const submitted=requests.filter(r=>r.status==="submitted");
  const paidTotal=paid.reduce((sum,o)=>sum+(Number(o.amount_minor)||0),0);
  return <div className="overview-live">
    <div className="overview-live-heading"><div><p className="eyebrow">LIVE RECORDS</p><h2>Operational snapshot</h2><p>All figures below are from the authenticated API. No demo or fabricated transactions.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?"Refreshing…":"Refresh"}</button></div>
    {error&&<div className="demo-banner"><AlertCircle size={17}/><div><strong>Dashboard data could not be loaded</strong><span>{error}</span></div><button onClick={()=>onNavigate("Transactions")}>Transactions</button></div>}
    <section className="metrics">
      <Metric title="Payment orders" value={loading?"—":String(orders.length)} detail="Orders returned by API" icon={ReceiptText}/>
      <Metric title="Confirmed paid" value={loading?"—":String(paid.length)} detail={loading?"Loading":money(paidTotal)+" recorded"} icon={CheckCircle2}/>
      <Metric title="Pending orders" value={loading?"—":String(pending.length)} detail="Awaiting verification or completion" icon={Activity}/>
      <Metric title="Subscription reviews" value={loading?"—":String(submitted.length)} detail="Submitted proofs awaiting admin review" icon={ShieldCheck}/>
    </section>
    <section className="content-grid">
      <div className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent payment orders</h2><p>Latest live order records</p></div><button className="secondary-button" onClick={()=>onNavigate("Transactions")}>View all <ChevronRight size={14}/></button></div>
        {loading?<div className="no-results">Loading records…</div>:error?<div className="no-results">Live records unavailable.</div>:orders.length===0?<div className="no-results"><strong>No payment orders yet</strong><p>Orders will appear here when customers start checkout.</p></div>:<div className="table-wrap"><table><thead><tr><th>Order ID</th><th>Purpose</th><th>Method</th><th>Created</th><th>Amount</th><th>Status</th></tr></thead><tbody>{orders.slice(0,8).map(o=><tr key={o.id}><td className="id-cell">{o.id}</td><td>{o.purpose}</td><td>{o.provider==="direct_upi"?"Direct UPI":o.provider}</td><td>{new Date(o.created_at).toLocaleString("en-IN")}</td><td className="amount-cell">{money(o.amount_minor,o.currency)}</td><td><span className={"pill "+(o.status||"").toLowerCase()}>{o.status}</span></td></tr>)}</tbody></table></div>}
      </div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Admin workflow</p></div></div><div className="quick-actions-grid">{quickActions.map(({label,description,icon:Icon,target})=><button className="quick-action" key={label} onClick={()=>onNavigate(target)}><span className="quick-action-icon"><Icon size={18}/></span><span className="quick-action-copy"><strong>{label}</strong><small>{description}</small></span><ChevronRight className="quick-action-arrow" size={15}/></button>)}</div><div className="quick-panel-foot"><ShieldCheck size={15}/><span>Payment approvals require manual bank-credit verification.</span></div></div>
    </section>
  </div>;
}
