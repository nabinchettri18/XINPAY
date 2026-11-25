import { supabase } from "./lib/supabase";
import { useMemo, useState } from "react";
import PaymentSettings from "./PaymentSettings";
import AdminTransactions from "./AdminTransactions";
import {
  Activity, AlertCircle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell,
  Building2, CheckCircle2, ChevronDown, ChevronRight, CircleHelp,
  CreditCard, LayoutDashboard, LockKeyhole, Menu, RefreshCw, ReceiptText,
  Search, Settings, ShieldCheck, Wallet, X, LogOut
} from "lucide-react";

type NavKey = "Overview" | "Transactions" | "Settlements" | "Accounts" | "Customers" | "Support" | "Payment Settings" | "Settings";
const navItems: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Transactions", icon: Activity },
  { label: "Settlements", icon: Wallet },
  { label: "Accounts", icon: Building2 },
  { label: "Customers", icon: CreditCard },
  { label: "Support", icon: CircleHelp },
  { label: "Payment Settings", icon: Wallet },
  { label: "Settings", icon: Settings }
];

const transactions = [
  { id: "XP-10482", customer: "Aarav Sharma", date: "24 Nov, 10:42 AM", amount: "₹12,450.00", status: "Completed", type: "Payment" },
  { id: "XP-10481", customer: "Meera Kapoor", date: "24 Nov, 10:18 AM", amount: "₹8,200.00", status: "Pending", type: "Payment" },
  { id: "XP-10480", customer: "Rohan Mehta", date: "24 Nov, 09:56 AM", amount: "₹3,650.00", status: "Failed", type: "Refund" },
  { id: "XP-10479", customer: "Isha Verma", date: "24 Nov, 09:31 AM", amount: "₹18,000.00", status: "Completed", type: "Payment" },
  { id: "XP-10478", customer: "Kabir Singh", date: "24 Nov, 09:04 AM", amount: "₹5,500.00", status: "Completed", type: "Payment" }
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
  const [query, setQuery] = useState("");
  const [showNotice, setShowNotice] = useState(true);
  const filtered = useMemo(
    () => transactions.filter(t => (t.id + t.customer + t.status + t.type).toLowerCase().includes(query.toLowerCase())),
    [query]
  );
  const completed = transactions.filter(t => t.status === "Completed").length;
  const pending = transactions.filter(t => t.status === "Pending").length;
  const failed = transactions.filter(t => t.status === "Failed").length;
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
          <div><strong>XinPay Workspace</strong><small>Demo environment</small></div>
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
          <div className="security-note"><ShieldCheck size={17}/><span><strong>Demo workspace</strong><small>Sample data · no live money</small></span></div>
          <div className="profile"><div className="avatar">DA</div><div><strong>Demo Admin</strong><small>Administrator</small></div><ChevronDown size={16}/></div>
        </div>
      </aside>

      {mobileOpen && <button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu/></button>
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{active}</strong></div>
          {active==="Overview"&&<label className="topbar-search">
            <Search size={16}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transactions or IDs"/>
            <kbd>/</kbd>
          </label>}
          <div className="top-actions">
            <button className="icon-btn" aria-label="Refresh demo view" title="Refresh view" onClick={()=>setQuery("")}><RefreshCw size={17}/></button>
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
              <p className="subheading">{active==="Overview"?"Here's an overview of your XinPay payment activity.":"Monitor activity and manage your payment operations."}</p>
            </div>
            {active==="Overview"&&<div className="welcome-actions">
              <button className="welcome-secondary" onClick={()=>go("Transactions")}><RefreshCw size={15}/> Reconcile</button>
              <button className="welcome-primary" onClick={()=>go("Payment Settings")}><Settings size={15}/> Payment settings</button>
            </div>}
          </div>

          {showNotice&&<div className="demo-banner">
            <LockKeyhole size={18}/>
            <div><strong>Prototype environment</strong><span>All overview figures and chart values are illustrative sample data. No payment, settlement, or account changes are performed here.</span></div>
            <button onClick={()=>setShowNotice(false)} aria-label="Dismiss demo notice"><X size={17}/></button>
          </div>}

          {active==="Overview" ? <>
            <section className="metrics">
              <Metric title="Total processed" value="₹8,42,560" change="+12.8%" icon={Wallet} note="vs. previous period"/>
              <Metric title="Successful payments" value="1,284" change="+8.4%" icon={CheckCircle2} note="vs. previous period"/>
              <Metric title="Pending settlements" value="₹1,24,800" change="4 batches" icon={Building2} note="Sample queue"/>
              <Metric title="Payment success rate" value="96.8%" change="+1.2%" icon={Activity} note="vs. previous period"/>
            </section>

            <section className="content-grid">
              <div className="panel chart-panel">
                <div className="panel-heading">
                  <div><h2>Payment volume</h2><p>Illustrative activity · last 7 days</p></div>
                  <div className="chart-legend-group"><span className="chart-legend"><i/> Successful</span><span className="chart-legend secondary"><i/> Pending</span></div>
                </div>
                <div className="chart">
                  <div className="chart-grid"><span>₹2.0L</span><span>₹1.5L</span><span>₹1.0L</span><span>₹0.5L</span><span>₹0</span></div>
                  <svg viewBox="0 0 700 230" preserveAspectRatio="none" className="chart-svg" role="img" aria-label="Illustrative payment volume line chart">
                    <defs>
                      <linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8065f6" stopOpacity=".2"/><stop offset="100%" stopColor="#8065f6" stopOpacity="0"/></linearGradient>
                    </defs>
                    <path d="M0,175 C45,150 65,160 105,130 S165,148 205,100 S270,135 310,92 S370,110 415,62 S475,88 515,80 S575,40 620,54 S665,20 700,36 L700,230 L0,230 Z" fill="url(#area)"/>
                    <path d="M0,175 C45,150 65,160 105,130 S165,148 205,100 S270,135 310,92 S370,110 415,62 S475,88 515,80 S575,40 620,54 S665,20 700,36" fill="none" stroke="#8065f6" strokeWidth="3"/>
                    <path d="M0,198 C55,182 70,190 115,169 S180,174 220,151 S280,161 330,140 S390,151 430,126 S490,143 535,112 S590,128 630,106 S674,94 700,103" fill="none" stroke="#e2b65f" strokeWidth="2.5" strokeLinecap="round"/>
                    <circle cx="415" cy="62" r="5" fill="#8065f6" stroke="#fff" strokeWidth="3"/>
                  </svg>
                  <div className="chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
                </div>
                <div className="chart-footnote"><span><i className="status-dot green"/> Successful payments trend</span><span><i className="status-dot amber"/> Pending payment trend</span></div>
              </div>

              <div className="panel quick-panel">
                <div className="panel-heading"><div><h2>Quick actions</h2><p>Common operational tasks</p></div><span className="panel-more"><ChevronRight size={16}/></span></div>
                <div className="quick-actions-grid">
                  {quickActions.map(({label,description,icon:Icon,target})=>(
                    <button className="quick-action" key={label} onClick={()=>go(target)}>
                      <span className="quick-action-icon"><Icon size={18}/></span>
                      <span className="quick-action-copy"><strong>{label}</strong><small>{description}</small></span>
                      <ChevronRight className="quick-action-arrow" size={15}/>
                    </button>
                  ))}
                </div>
                <div className="quick-panel-foot"><ShieldCheck size={15}/><span>Admin actions are restricted to authenticated sessions.</span></div>
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel transactions-panel">
                <div className="panel-heading transaction-heading">
                  <div><h2>Recent transactions</h2><p>Latest sample activity</p></div>
                  <div className="table-actions"><button className="secondary-button" onClick={()=>go("Transactions")}>View all <ChevronRight size={14}/></button></div>
                </div>
                <div className="table-wrap">
                  <table><thead><tr><th>Transaction ID</th><th>Customer</th><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>{filtered.map(t=><tr key={t.id}>
                      <td className="id-cell">{t.id}</td><td>{t.customer}</td>
                      <td><span className="type-icon">{t.type==="Refund"?<ArrowUpRight size={14}/>:<ArrowDownLeft size={14}/>}</span>{t.type}</td>
                      <td className="date-cell">{t.date}</td><td className="amount-cell">{t.amount}</td>
                      <td><span className={"pill "+t.status.toLowerCase()}>{t.status}</span></td>
                    </tr>)}</tbody>
                  </table>
                  {filtered.length===0&&<div className="no-results">No matching sample transactions. Try another search.</div>}
                </div>
              </div>

              <div className="panel movement-panel">
                <div className="panel-heading"><div><h2>Transaction status</h2><p>Based on 5 sample records</p></div><span className="panel-more"><Activity size={16}/></span></div>
                <div className="status-summary"><strong>{transactions.length.toString().padStart(2,"0")}</strong><span>Sample transactions</span></div>
                <div className="status-stack" aria-label="60 percent completed, 20 percent pending, 20 percent failed">
                  <span className="status-stack-complete" style={{width:(completed/transactions.length*100)+"%"}}/>
                  <span className="status-stack-pending" style={{width:(pending/transactions.length*100)+"%"}}/>
                  <span className="status-stack-failed" style={{width:(failed/transactions.length*100)+"%"}}/>
                </div>
                <div className="status-breakdown">
                  <div><span><i className="status-key complete"/>Completed</span><strong>{completed}</strong></div>
                  <div><span><i className="status-key pending"/>Pending</span><strong>{pending}</strong></div>
                  <div><span><i className="status-key failed"/>Failed</span><strong>{failed}</strong></div>
                </div>
                <div className="movement-note"><AlertCircle size={15}/><span>These counts describe the demo rows above, not live payment records.</span></div>
              </div>
            </section>
          </> : active==="Payment Settings" ? <PaymentSettings/> : active==="Transactions" ? <AdminTransactions/> :
            <section className="panel section-panel">
              <div className="empty-icon">{navItems.find(n=>n.label===active)?.icon && (()=>{const I=navItems.find(n=>n.label===active)!.icon;return <I size={24}/>})()}</div>
              <h2>{active} module</h2>
              <p>This module is scaffolded for the next development phase. No live financial actions are enabled.</p>
              <div className="module-list"><span>✓ UI shell and navigation</span><span>○ Backend integration pending</span><span>○ Permissions and audit controls pending</span></div>
            </section>
          }

          <footer>XinPay prototype <span>•</span> Sample data only <span>•</span> Not connected to a live balance feed</footer>
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
