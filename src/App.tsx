import { supabase } from "./lib/supabase";
import { useEffect, useState } from "react";
import PaymentSettings from "./PaymentSettings";
import AdminTransactions from "./AdminTransactions";
import AdminSubscriptionRequests from "./AdminSubscriptionRequests";
import {
  Activity, AlertCircle, Bell, Building2, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, CreditCard, LayoutDashboard, Menu, RefreshCw, ReceiptText,
  Settings, ShieldCheck, Wallet, LogOut
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
  { label: "Payment Settings", icon: Wallet },
  { label: "Settings", icon: Settings }
];

const quickActions: { label: string; description: string; icon: typeof Activity; target: NavKey }[] = [
  { label: "Transactions", description: "Review payment activity", icon: ReceiptText, target: "Transactions" },
  { label: "Reconciliation", description: "Match pending UPI credits", icon: RefreshCw, target: "Transactions" },
  { label: "Payment settings", description: "Manage receiving details", icon: Settings, target: "Payment Settings" },
  { label: "Settlements", description: "View settlement workspace", icon: ArrowLeftRight, target: "Settlements" }
];

export default function App() {
  const [active, setActive] = useState<NavKey>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = (section: NavKey) => {
    setActive(section);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">X</div>
          <div><strong>xinpay</strong><small>PAYMENT OPERATIONS</small></div>
        </div>
        <div className="workspace">
          <span className="workspace-icon">XP</span>
          <div><strong>XinPay Admin</strong><small>Payment operations</small></div>
          <ChevronDown size={16}/>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navItems.map(({label,icon:Icon}) => (
            <button key={label} className={active===label?"nav-item active":"nav-item"} onClick={()=>go(label)}>
              <Icon size={18}/><span>{label}</span>
              {label==="Support"&&<span className="nav-count">2</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note"><ShieldCheck size={17}/><span><strong>Secure admin session</strong><small>Restricted access · verified sign-in</small></span></div>
          <div className="profile"><div className="avatar">AD</div><div><strong>Administrator</strong><small>Administrator</small></div><ChevronDown size={16}/></div>
        </div>
      </aside>

      {mobileOpen && <button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu/></button>
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{active}</strong></div>
          <div className="top-actions">
            
            <button className="icon-btn notification" aria-label="Notifications not connected" title="Notifications are not connected" disabled><Bell size={18}/><i/></button>
            <button className="admin-signout" onClick={()=>void supabase?.auth.signOut()} title="Sign out" aria-label="Sign out"><LogOut size={16}/><span>Sign out</span></button>
            <div className="avatar small">DA</div>
          </div>
        </header>

        <div className="page-content">
          <div className="overview-welcome">
            <div>
              <p className="eyebrow">PAYMENT OPERATIONS · WORKSPACE</p>
              <h1>{active==="Overview"?"Welcome back, Admin":active}</h1>
              <p className="subheading">{active==="Overview"?"Here's an overview of your XinPay payment activity.":"Review customer plan payments and manage your payment operations."}</p>
            </div>
            {active==="Overview"&&<div className="welcome-actions">
              <button className="welcome-secondary" onClick={()=>go("Transactions")}><RefreshCw size={15}/> Reconcile</button>
              <button className="welcome-primary" onClick={()=>go("Payment Settings")}><Settings size={15}/> Payment settings</button>
            </div>}
          </div>


          {active==="Overview" ? <Overview onNavigate={go}/> : active==="Payment Settings" ? <PaymentSettings/> : active==="Transactions" ? <AdminTransactions/> : active==="Subscription Requests" ? <AdminSubscriptionRequests/> :\n            <section className="panel section-panel">\n              <div className="empty-icon">{navItems.find(n=>n.label===active)?.icon && (()=>{const I=navItems.find(n=>n.label===active)!.icon;return <I size={24}/>})()}</div>\n              <h2>{active} module</h2>\n              <p>This module is not connected to live records yet.</p>\n              <div className="module-list"><span>✓ UI shell and navigation</span><span>○ Backend integration pending</span><span>○ Permissions and audit controls pending</span></div>\n            </section>\n          }\n\n          <footer>XinPay Admin <span>•</span> Secure operations console</footer>
        </div>
      </main>
    </div>
  );
}

function Metric({title,value,change,icon:Icon,note}:{title:string;value:string;change:string;icon:any;note:string}) {
  return <div className="metric-card">
    <div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={18}/></div></div>
    <strong className="metric-value">{value}</strong>
    <div className="metric-bottom"><span className="metric-change">{change}</span><span>{note}</span></div>
  </div>;
}
\nfunction Overview({onNavigate}:{onNavigate:(section:NavKey)=>void}) {\n  type Order={id:string;provider:string;purpose:string;amount_minor:number;currency:string;status:string;created_at:string};\n  const [orders,setOrders]=useState<Order[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");\n  async function load(){setLoading(true);setError("");try{const r=await fetch("/api/admin/orders",{headers:{Accept:"application/json"},cache:"no-store"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Unable to load operational data.");setOrders(Array.isArray(d.orders)?d.orders:[])}catch(e){setError(e instanceof Error?e.message:"Unable to load operational data.")}finally{setLoading(false)}}\n  useEffect(()=>{void load()},[]);\n  const money=(minor:number,currency:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency}).format(minor/100);\n  const paid=orders.filter(o=>["paid","completed","success","succeeded"].includes((o.status||"").toLowerCase()));\n  const pending=orders.filter(o=>["pending","review","awaiting_payment","submitted"].includes((o.status||"").toLowerCase()));\n  const rejected=orders.filter(o=>(o.status||"").toLowerCase()==="rejected");\n  return <div className="overview-live">\n    <div className="overview-live-heading"><div><p className="eyebrow">LIVE OPERATIONAL RECORDS</p><h2>Payment overview</h2><p>Data is loaded from XinPay's admin payment-order records. No illustrative metrics or transactions are shown.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> {loading?"Loading…":"Refresh data"}</button></div>\n    {error&&<div className="demo-banner"><AlertCircle size={17}/><div><strong>Live data unavailable</strong><span>{error}</span></div><button onClick={()=>onNavigate("Transactions")}>Open transactions</button></div>}\n    <section className="metrics">\n      <Metric title="Orders loaded" value={loading?"—":String(orders.length)} change="Live records" icon={ReceiptText} note="Latest 100 orders"/>\n      <Metric title="Paid orders" value={loading?"—":String(paid.length)} change="Verified statuses" icon={CheckCircle2} note="Within loaded records"/>\n      <Metric title="Pending review" value={loading?"—":String(pending.length)} change="Requires attention" icon={Activity} note="Within loaded records"/>\n      <Metric title="Rejected orders" value={loading?"—":String(rejected.length)} change="Recorded status" icon={AlertCircle} note="Within loaded records"/>\n    </section>\n    <section className="content-grid">\n      <div className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent payment orders</h2><p>Real records returned by the admin orders API</p></div><button className="secondary-button" onClick={()=>onNavigate("Transactions")}>Manage orders <ChevronRight size={14}/></button></div>\n      {loading?<div className="no-results">Loading payment records…</div>:error?<div className="no-results">Payment records could not be loaded.</div>:orders.length===0?<div className="no-results"><strong>No payment orders yet</strong><p>New customer payment orders will appear here after they are created.</p><button className="secondary-button" onClick={()=>onNavigate("Payment Settings")}>Configure payment settings</button></div>:<div className="table-wrap"><table><thead><tr><th>Order ID</th><th>Purpose</th><th>Method</th><th>Created</th><th>Amount</th><th>Status</th></tr></thead><tbody>{orders.slice(0,8).map(o=><tr key={o.id}><td className="id-cell">{o.id}</td><td>{o.purpose}</td><td>{o.provider==="direct_upi"?"Direct UPI":o.provider}</td><td>{new Date(o.created_at).toLocaleString("en-IN")}</td><td className="amount-cell">{money(o.amount_minor,o.currency)}</td><td><span className={"pill "+(o.status||"").toLowerCase()}>{o.status}</span></td></tr>)}</tbody></table></div>}</div>\n      <div className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Operational tools</p></div></div><div className="quick-actions-grid">{quickActions.map(({label,description,icon:Icon,target})=><button className="quick-action" key={label} onClick={()=>onNavigate(target)}><span className="quick-action-icon"><Icon size={18}/></span><span className="quick-action-copy"><strong>{label}</strong><small>{description}</small></span><ChevronRight className="quick-action-arrow" size={15}/></button>)}</div><div className="quick-panel-foot"><ShieldCheck size={15}/><span>Admin actions require an authenticated session.</span></div></div>\n    </section>\n  </div>;\n}\n