import { useCallback, useEffect, useMemo, useState } from "react";
import PaymentSettings from "./PaymentSettings";
import { supabase } from "./paymentConfig";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, Building2, ChevronDown,
  CircleHelp, CreditCard, LayoutDashboard, LockKeyhole, Menu, RefreshCw,
  Search, Settings, ShieldCheck, Wallet, X, CheckCircle2, Clock3, AlertCircle
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
type Topup={id:string;customer_id:string;customer_email:string;amount_minor:number;status:string;utr:string|null;submitted_at:string|null;created_at:string;receiver_upi_id:string;receiver_beneficiary:string};
type Withdrawal={id:string;customer_id:string;customer_email:string;amount_minor:number;status:string;payout_method:string;payout_destination:string;requested_at:string};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format((n||0)/100);
const date=(v:string|null)=>v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";
const statusClass=(s:string)=>s==="approved"||s==="paid"?"success":s==="rejected"?"danger":s==="processing"?"info":"pending";

export default function App(){
 const [active,setActive]=useState<NavKey>("Overview");
 const [mobileOpen,setMobileOpen]=useState(false);
 const [query,setQuery]=useState("");
 const [topups,setTopups]=useState<Topup[]>([]);
 const [withdrawals,setWithdrawals]=useState<Withdrawal[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState("");
 const [adminEmail,setAdminEmail]=useState("Admin");
 const load=useCallback(async(initial=false)=>{
  if(initial)setLoading(true);else setRefreshing(true);
  setError("");
  const [t,w,user]=await Promise.all([
   supabase.rpc("admin_list_wallet_topups",{p_status:"all"}),
   supabase.rpc("admin_list_withdrawal_requests",{p_status:"all"}),
   supabase.auth.getUser()
  ]);
  if(t.error||w.error){setError([t.error?.message,w.error?.message].filter(Boolean).join(" · "));}
  setTopups((t.data||[]) as Topup[]);setWithdrawals((w.data||[]) as Withdrawal[]);
  if(user.data.user?.email)setAdminEmail(user.data.user.email);
  setLoading(false);setRefreshing(false);
 },[]);
 useEffect(()=>{load(true)},[load]);
 const pendingTopups=topups.filter(x=>x.status==="submitted");
 const pendingWithdrawals=withdrawals.filter(x=>x.status==="requested");
 const approvedTopups=topups.filter(x=>x.status==="approved");
 const reviewedTopupValue=approvedTopups.reduce((a,x)=>a+(Number(x.amount_minor)||0),0);
 const pendingTopupValue=pendingTopups.reduce((a,x)=>a+(Number(x.amount_minor)||0),0);
 const pendingWithdrawalValue=pendingWithdrawals.reduce((a,x)=>a+(Number(x.amount_minor)||0),0);
 const activity=useMemo(()=>[
  ...topups.map(x=>({id:x.id,type:"Wallet top-up",customer:x.customer_email||x.customer_id,amount:Number(x.amount_minor)||0,status:x.status,time:x.submitted_at||x.created_at,ref:x.utr||x.id})),
  ...withdrawals.map(x=>({id:x.id,type:"Withdrawal",customer:x.customer_email||x.customer_id,amount:Number(x.amount_minor)||0,status:x.status,time:x.requested_at,ref:x.payout_method+" · "+x.payout_destination}))
 ].sort((a,b)=>new Date(b.time||0).getTime()-new Date(a.time||0).getTime()).slice(0,12),[topups,withdrawals]);
 const filtered=activity.filter(x=>(x.id+x.customer+x.type+x.status+x.ref).toLowerCase().includes(query.toLowerCase()));
 return <div className="app-shell live-shell">
  <aside className={mobileOpen?"sidebar open":"sidebar"}>
   <div className="brand"><div className="brand-mark">X</div><div><strong>xinpay</strong><small>PAYMENT OPERATIONS</small></div></div>
   <div className="workspace"><span className="workspace-icon">XP</span><div><strong>XinPay Workspace</strong><small>Live operations</small></div><ChevronDown size={16}/></div>
   <p className="nav-label">WORKSPACE</p><nav>{navItems.map(({label,icon:Icon})=><button key={label} className={active===label?"nav-item active":"nav-item"} onClick={()=>{setActive(label);setMobileOpen(false)}}><Icon size={18}/><span>{label}</span>{label==="Support"&&<span className="nav-count">—</span>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17}/><span><strong>Secure workspace</strong><small>Authenticated · Supabase</small></span></div><div className="profile"><div className="avatar">{adminEmail.slice(0,2).toUpperCase()}</div><div><strong>{adminEmail}</strong><small>Administrator</small></div><ChevronDown size={16}/></div></div>
  </aside>
  {mobileOpen&&<button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
  <main className="main"><header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu/></button><div className="breadcrumbs">Workspace <span>/</span> <strong>{active}</strong></div><div className="top-actions"><button className="icon-btn" onClick={()=>document.getElementById("activity-search")?.focus()} aria-label="Search activity"><Search size={18}/></button><button className="icon-btn" onClick={()=>load()} aria-label="Refresh dashboard"><RefreshCw size={17}/></button><div className="avatar small">{adminEmail.slice(0,2).toUpperCase()}</div></div></header>
   <div className="page-content"><div className="page-heading"><div><p className="eyebrow">MONITORING & OPERATIONS</p><h1>{active}</h1><p className="subheading">Live wallet activity and payment operations.</p></div><button className="date-button" onClick={()=>load()} disabled={loading||refreshing}>{refreshing?"Refreshing…":"Refresh"} <RefreshCw size={15}/></button></div>
   {error&&<div className="live-error"><AlertCircle size={18}/><div><strong>Unable to load live data</strong><span>{error}</span></div><button onClick={()=>load()}>Retry</button></div>}
   {active==="Overview"?<>
    <div className="live-banner"><ShieldCheck size={19}/><div><strong>Live data · Supabase</strong><span>Figures below come from wallet top-up and withdrawal records. Payment proofs are not treated as payment verification.</span></div></div>
    {loading?<div className="live-loading"><RefreshCw className="spin" size={20}/> Loading your operations…</div>:<>
     <section className="metrics live-metrics">
      <Metric title="Top-ups awaiting review" value={pendingTopups.length.toLocaleString("en-IN")} sub={money(pendingTopupValue)+" pending"} icon={Clock3} tone="amber"/>
      <Metric title="Withdrawal requests" value={pendingWithdrawals.length.toLocaleString("en-IN")} sub={money(pendingWithdrawalValue)+" requested"} icon={ArrowUpRight} tone="blue"/>
      <Metric title="Approved top-ups" value={approvedTopups.length.toLocaleString("en-IN")} sub={money(reviewedTopupValue)+" approved"} icon={CheckCircle2} tone="green"/>
      <Metric title="Records loaded" value={(topups.length+withdrawals.length).toLocaleString("en-IN")} sub="Top-ups + withdrawals · recent records" icon={Activity} tone="neutral"/>
     </section>
     <section className="content-grid live-grid"><div className="panel live-panel"><div className="panel-heading"><div><h2>Wallet review queue</h2><p>Requests that need administrator action</p></div><button className="secondary-button" onClick={()=>setActive("Settlements")}>View queue</button></div>
      <div className="queue-row"><div className="queue-icon amber"><Clock3 size={18}/></div><div><strong>Top-up submissions</strong><small>Check UTR and independently confirm bank credit</small></div><b>{pendingTopups.length}</b></div>
      <div className="queue-row"><div className="queue-icon blue"><Wallet size={18}/></div><div><strong>Withdrawal requests</strong><small>Review request and payout destination</small></div><b>{pendingWithdrawals.length}</b></div>
      <div className="queue-row"><div className="queue-icon green"><CheckCircle2 size={18}/></div><div><strong>Approved top-ups</strong><small>Recorded as credited in wallet ledger</small></div><b>{approvedTopups.length}</b></div>
     </div><div className="panel live-panel"><div className="panel-heading"><div><h2>Operational safeguards</h2><p>Current workflow controls</p></div></div><div className="safeguard"><ShieldCheck size={17}/><span><strong>Admin RPC authorization</strong><small>Dashboard data uses admin-only Supabase functions</small></span><span className="safe-label">Enabled</span></div><div className="safeguard"><LockKeyhole size={17}/><span><strong>Top-up verification</strong><small>Requires bank-credit confirmation before approval</small></span><span className="safe-label">Required</span></div><div className="safeguard"><Activity size={17}/><span><strong>Audit trail</strong><small>Review actions are recorded by database functions</small></span><span className="safe-label">Enabled</span></div></div></section>
     <section className="panel transactions-panel"><div className="panel-heading transaction-heading"><div><h2>Recent wallet activity</h2><p>Actual top-up and withdrawal records</p></div><div className="table-actions"><div className="search-field"><Search size={16}/><input id="activity-search" placeholder="Search records" value={query} onChange={e=>setQuery(e.target.value)}/></div></div></div><div className="table-wrap"><table><thead><tr><th>Record</th><th>Customer</th><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td className="id-cell">{t.id}</td><td>{t.customer}</td><td><span className="type-icon">{t.type==="Withdrawal"?<ArrowUpRight size={14}/>:<ArrowDownLeft size={14}/>}</span>{t.type}</td><td className="date-cell">{date(t.time)}</td><td className="amount-cell">{money(t.amount)}</td><td><span className={"pill "+statusClass(t.status)}>{t.status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table>{filtered.length===0&&<div className="no-results">{query?"No matching records.":"No wallet activity has been recorded yet."}</div>}</div></section>
    </>}
   </>:active==="Payment Settings"?<PaymentSettings/>:<section className="panel section-panel"><div className="empty-icon">{(()=>{const I=navItems.find(n=>n.label===active)?.icon||LayoutDashboard;return <I size={24}/>})()}</div><h2>{active}</h2><p>This section is not connected yet. No sample records are shown.</p><div className="module-list"><span>✓ Secure admin workspace</span><span>○ Module integration pending</span></div></section>}
   <footer>XinPay · Live wallet data <span>•</span> Admin access <span>•</span> No sample figures</footer>
  </div></main></div>;
}
function Metric({title,value,sub,icon:Icon,tone}:{title:string;value:string;sub:string;icon:any;tone:string}){return <div className="metric-card live-metric-card"><div className="metric-top"><span>{title}</span><div className={"metric-icon "+tone}><Icon size={18}/></div></div><strong className="metric-value">{value}</strong><div className="metric-bottom"><span>{sub}</span></div></div>}
