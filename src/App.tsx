import { useState } from "react";
import PaymentSettings from "./PaymentSettings";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, Building2, ChevronDown,
  CircleHelp, CreditCard, FileCheck, LayoutDashboard, LockKeyhole, Menu, Search,
  Settings, ShieldCheck, Wallet, X
} from "lucide-react";

type NavKey = "Overview" | "Transactions" | "Settlements" | "Accounts" | "Customers" | "Support" | "Payment Settings" | "Payment Proof Review" | "Withdrawal Requests" | "Settings";
const navItems: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Transactions", icon: Activity },
  { label: "Settlements", icon: Wallet },
  { label: "Accounts", icon: Building2 },
  { label: "Customers", icon: CreditCard },
  { label: "Support", icon: CircleHelp },
  { label: "Payment Settings", icon: Wallet },
  { label: "Payment Proof Review", icon: FileCheck },
  { label: "Withdrawal Requests", icon: Wallet },
  { label: "Settings", icon: Settings }
];
const transactions = [
  { id: "XP-10482", customer: "Aarav Sharma", date: "24 Nov, 10:42 AM", amount: "₹12,450.00", status: "Completed", type: "Payment" },
  { id: "XP-10481", customer: "Meera Kapoor", date: "24 Nov, 10:18 AM", amount: "₹8,200.00", status: "Pending", type: "Payment" },
  { id: "XP-10480", customer: "Rohan Mehta", date: "24 Nov, 09:56 AM", amount: "₹3,650.00", status: "Failed", type: "Refund" },
  { id: "XP-10479", customer: "Isha Verma", date: "24 Nov, 09:31 AM", amount: "₹18,000.00", status: "Completed", type: "Payment" },
  { id: "XP-10478", customer: "Kabir Singh", date: "24 Nov, 09:04 AM", amount: "₹5,500.00", status: "Completed", type: "Payment" }
];

export default function App() {
  const [active, setActive] = useState<NavKey>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showNotice, setShowNotice] = useState(true);
  const filtered = transactions.filter(t => (t.id + t.customer + t.status).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><div className="brand-mark">X</div><div><strong>xinpay</strong><small>PAYMENT OPERATIONS</small></div></div>
        <div className="workspace"><span className="workspace-icon">XP</span><div><strong>XinPay Workspace</strong><small>Demo environment</small></div><ChevronDown size={16}/></div>
        <p className="nav-label">WORKSPACE</p>
        <nav>{navItems.map(({label,icon:Icon})=><button key={label} className={active===label?"nav-item active":"nav-item"} onClick={()=>{if(label==="Payment Proof Review"){window.location.href="/admin/proofs";return;}if(label==="Withdrawal Requests"){window.location.href="/admin/withdrawals";return;}setActive(label);setMobileOpen(false)}}><Icon size={18}/><span>{label}</span>{label==="Support"&&<span className="nav-count">2</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17}/><span><strong>Demo workspace</strong><small>Demo · no live money</small></span></div><div className="profile"><div className="avatar">DA</div><div><strong>Demo Admin</strong><small>Demo account</small></div><ChevronDown size={16}/></div></div>
      </aside>
      {mobileOpen && <button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
      <main className="main">
        <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="breadcrumbs">Workspace <span>/</span> <strong>{active}</strong></div><div className="top-actions"><button className="icon-btn" aria-label="Search (coming soon)" title="Search is not connected" disabled><Search size={18}/></button><button className="icon-btn notification" aria-label="Notifications (coming soon)" title="Notifications are not connected" disabled><Bell size={18}/><i/></button><div className="avatar small">DA</div></div></header>
        <div className="page-content">
          <div className="page-heading"><div><p className="eyebrow">MONITORING & OPERATIONS</p><h1>{active}</h1><p className="subheading">Monitor activity and manage your payment operations.</p></div><button className="date-button" disabled aria-label="Date filter unavailable in demo">Today <ChevronDown size={16}/></button></div>
          {showNotice&&<div className="demo-banner"><LockKeyhole size={18}/><div><strong>Prototype environment</strong><span>Sample figures and transactions are illustrative. No payment, settlement, or account changes are performed.</span></div><button onClick={()=>setShowNotice(false)} aria-label="Dismiss"><X size={17}/></button></div>}
          {active==="Overview" ? <>
            <section className="metrics">
              <Metric title="Total processed" value="₹8,42,560" change="+12.8%" icon={Wallet} note="vs. previous period"/>
              <Metric title="Successful payments" value="1,284" change="+8.4%" icon={ArrowDownLeft} note="vs. previous period"/>
              <Metric title="Pending settlements" value="₹1,24,800" change="4 batches" icon={Building2} note="Awaiting reconciliation"/>
              <Metric title="Payment success rate" value="96.8%" change="+1.2%" icon={Activity} note="vs. previous period"/>
            </section>
            <section className="content-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h2>Payment volume</h2><p>Illustrative weekly trend</p></div><div className="chart-legend"><i/> Volume</div></div><div className="chart"><div className="chart-grid"><span>₹2.0L</span><span>₹1.5L</span><span>₹1.0L</span><span>₹0.5L</span><span>₹0</span></div><svg viewBox="0 0 700 230" preserveAspectRatio="none" className="chart-svg"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6888ff" stopOpacity=".22"/><stop offset="100%" stopColor="#6888ff" stopOpacity="0"/></linearGradient></defs><path d="M0,175 C45,150 65,160 105,130 S165,148 205,100 S270,135 310,92 S370,110 415,62 S475,88 515,80 S575,40 620,54 S665,20 700,36 L700,230 L0,230 Z" fill="url(#area)"/><path d="M0,175 C45,150 65,160 105,130 S165,148 205,100 S270,135 310,92 S370,110 415,62 S475,88 515,80 S575,40 620,54 S665,20 700,36" fill="none" stroke="#6888ff" strokeWidth="3"/></svg><div className="chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div><div className="panel activity-panel"><div className="panel-heading"><div><h2>Quick overview</h2><p>Operational status</p></div></div><div className="status-row"><span className="status-dot green"/><div><strong>Payment API</strong><small>Demo status · operational</small></div><span className="status-label">Healthy</span></div><div className="status-row"><span className="status-dot green"/><div><strong>Webhook processing</strong><small>Demo status</small></div><span className="status-label">Healthy</span></div><div className="status-row"><span className="status-dot amber"/><div><strong>Settlement queue</strong><small>Sample pending items</small></div><span className="status-label warning">Review</span></div><div className="activity-footer"><ShieldCheck size={16}/> Security & audit controls planned</div></div></section>
          </> : active==="Payment Settings" ? <PaymentSettings/> : <section className="panel section-panel"><div className="empty-icon">{navItems.find(n=>n.label===active)?.icon && (()=>{const I=navItems.find(n=>n.label===active)!.icon;return <I size={24}/>})()}</div><h2>{active} module</h2><p>This module is scaffolded for the next development phase. No live financial actions are enabled.</p><div className="module-list"><span>✓ UI shell and navigation</span><span>○ Backend integration pending</span><span>○ Permissions and audit controls pending</span></div></section>}
          {active==="Overview"&&<section className="panel transactions-panel"><div className="panel-heading transaction-heading"><div><h2>Recent transactions</h2><p>Sample activity · latest records</p></div><div className="table-actions"><div className="search-field"><Search size={16}/><input placeholder="Search transactions" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="secondary-button">View all</button></div></div><div className="table-wrap"><table><thead><tr><th>Transaction ID</th><th>Customer</th><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td className="id-cell">{t.id}</td><td>{t.customer}</td><td><span className="type-icon">{t.type==="Refund"?<ArrowUpRight size={14}/>:<ArrowDownLeft size={14}/>}</span>{t.type}</td><td className="date-cell">{t.date}</td><td className="amount-cell">{t.amount}</td><td><span className={"pill "+t.status.toLowerCase()}>{t.status}</span></td></tr>)}</tbody></table>{filtered.length===0&&<div className="no-results">No matching demo transactions.</div>}</div></section>}
          <footer>XinPay prototype <span>•</span> Sample data only <span>•</span> Not connected to a payment processor</footer>
        </div>
      </main>
    </div>
  );
}
function Metric({title,value,change,icon:Icon,note}:{title:string;value:string;change:string;icon:any;note:string}) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={18}/></div></div><strong className="metric-value">{value}</strong><div className="metric-bottom"><span className="metric-change">{change}</span><span>{note}</span></div></div>;
}