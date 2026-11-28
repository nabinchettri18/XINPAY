import { useCallback, useEffect, useMemo, useState } from "react";
import PaymentSettings from "./PaymentSettings";
import { supabase } from "./paymentConfig";
import EasePayLogo from "./EasePayLogo";
import {
  Activity, ArrowUpRight, Bell, Building2, ChevronDown, CircleHelp,
  CreditCard, FileCheck, LayoutDashboard, Menu, Search, Settings,
  ShieldCheck, Wallet, X, Users, LogOut, RefreshCw, ClipboardList
} from "lucide-react";

type NavKey = "Overview" | "Transactions" | "Settlements" | "Accounts" | "Customers" | "Support" | "Payment Settings" | "Payment Proof Review" | "Withdrawal Requests" | "Wallet Top-ups" | "Referrals" | "Audit Logs" | "Settings";
const navItems: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Transactions", icon: Activity },
  { label: "Settlements", icon: Wallet }, { label: "Accounts", icon: Building2 },
  { label: "Customers", icon: Users }, { label: "Support", icon: CircleHelp },
  { label: "Payment Settings", icon: Wallet }, { label: "Payment Proof Review", icon: FileCheck },
  { label: "Withdrawal Requests", icon: Wallet }, { label: "Wallet Top-ups", icon: Wallet },
  { label: "Referrals", icon: Users }, { label: "Audit Logs", icon: ClipboardList }, { label: "Settings", icon: Settings }
];
type Customer={customer_id:string;email:string|null;full_name:string;referral_code:string|null;link_created_at:string|null;link_revoked_at:string|null;referral_count:number;qualified_count:number;rewarded_minor:number};
type Proof={id:string;customer_email:string|null;plan_name:string;amount_minor:number;status:string;utr:string|null;submitted_at:string|null;created_at:string};
type Topup={id:string;customer_email:string|null;amount_minor:number;status:string;utr:string|null;submitted_at:string|null;created_at:string};
type Withdrawal={id:string;customer_email:string|null;amount_minor:number;status:string;requested_at:string};
type Audit={id:string;actor_id:string|null;action:string;target:string|null;created_at:string;request_id:string|null};
type SupportTicket={id:string;customer_id:string;customer_email:string;category:string;subject:string;message:string;reference_id:string|null;status:string;created_at:string;updated_at:string;admin_reply:string|null;replied_at:string|null};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format((Number(n)||0)/100);
const stamp=(v:string|null)=>v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";

export default function App(){
  const [active,setActive]=useState<NavKey>(()=>{const q=new URLSearchParams(window.location.search).get("section");return navItems.some(n=>n.label===q)?q as NavKey:"Overview";});
  const [mobileOpen,setMobileOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [showNotice,setShowNotice]=useState(true);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [proofs,setProofs]=useState<Proof[]>([]);
  const [topups,setTopups]=useState<Topup[]>([]);
  const [withdrawals,setWithdrawals]=useState<Withdrawal[]>([]);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [lastUpdated,setLastUpdated]=useState("");
  const [tickets,setTickets]=useState<SupportTicket[]>([]);const [ticketFilter,setTicketFilter]=useState("all");const [ticketReplies,setTicketReplies]=useState<Record<string,string>>({});const [ticketBusy,setTicketBusy]=useState<string|null>(null);

  const loadOverview=useCallback(async()=>{
    setLoading(true);setError("");
    const [customerRes,proofRes,topupRes,withdrawRes,auditRes]=await Promise.all([
      supabase.rpc("admin_list_referral_accounts",{p_search:""}),
      supabase.from("subscription_payment_requests").select("id,customer_email,plan_name,amount_minor,status,utr,submitted_at,created_at").order("created_at",{ascending:false}).limit(100),
      supabase.rpc("admin_list_wallet_topups",{p_status:"all"}),
      supabase.rpc("admin_list_withdrawal_requests",{p_status:"all"}),
      supabase.from("audit_logs").select("id,actor_id,action,target,created_at,request_id").order("created_at",{ascending:false}).limit(25)
    ]);
    if(customerRes.error)setError(customerRes.error.message);
    else setCustomers((customerRes.data||[]) as Customer[]);
    if(proofRes.error)setError(prev=>prev||proofRes.error.message);
    else setProofs((proofRes.data||[]) as Proof[]);
    if(topupRes.error)setError(prev=>prev||topupRes.error.message);
    else setTopups((topupRes.data||[]) as Topup[]);
    if(withdrawRes.error)setError(prev=>prev||withdrawRes.error.message);
    else setWithdrawals((withdrawRes.data||[]) as Withdrawal[]);
    if(auditRes.error)setError(prev=>prev||auditRes.error.message);
    else setAudit((auditRes.data||[]) as Audit[]);
    setLastUpdated(new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
    setLoading(false);
  },[]);
  const loadCustomers=useCallback(async()=>{
    setLoading(true);setError("");
    const {data,error}=await supabase.rpc("admin_list_referral_accounts",{p_search:query.trim()});
    if(error){setError(error.message);setCustomers([]);}else setCustomers((data||[]) as Customer[]);
    setLastUpdated(new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));setLoading(false);
  },[query]);
  useEffect(()=>{if(active==="Overview"||active==="Audit Logs"||active==="Transactions"||active==="Settlements"||active==="Accounts"||active==="Support"||active==="Settings")loadOverview();},[active,loadOverview]);
  useEffect(()=>{if(active==="Customers")loadCustomers();},[active,loadCustomers]);
  useEffect(()=>{if(active==="Support")loadTickets();},[active,loadTickets]);

  const pendingProofs=proofs.filter(p=>p.status==="submitted");
  const pendingTopups=topups.filter(t=>t.status==="submitted");
  const pendingWithdrawals=withdrawals.filter(w=>w.status==="requested");
  const totalReceived=proofs.filter(p=>p.status==="approved").reduce((s,p)=>s+Number(p.amount_minor||0),0)+topups.filter(t=>t.status==="approved").reduce((s,t)=>s+Number(t.amount_minor||0),0);
  const recent=useMemo(()=>[
    ...proofs.map(p=>({id:p.id,label:"Subscription payment proof",customer:p.customer_email||"Customer",amount:Number(p.amount_minor||0),status:p.status,time:p.submitted_at||p.created_at,type:"proof"})),
    ...topups.map(t=>({id:t.id,label:"Wallet top-up",customer:t.customer_email||"Customer",amount:Number(t.amount_minor||0),status:t.status,time:t.submitted_at||t.created_at,type:"topup"})),
    ...withdrawals.map(w=>({id:w.id,label:"Withdrawal request",customer:w.customer_email||"Customer",amount:Number(w.amount_minor||0),status:w.status,time:w.requested_at,type:"withdrawal"}))
  ].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,8),[proofs,topups,withdrawals]);

  const go=(label:NavKey)=>{setError("");if(label==="Payment Proof Review"){window.location.href="/admin236794/proofs";return;}if(label==="Withdrawal Requests"){window.location.href="/admin236794/withdrawals";return;}if(label==="Wallet Top-ups"){window.location.href="/admin236794/topups";return;}if(label==="Referrals"){window.location.href="/admin236794/referrals";return;}setActive(label);setMobileOpen(false);setQuery("");};
  return <div className="app-shell">
    <aside className={mobileOpen?"sidebar open":"sidebar"}>
      <div className="brand"><EasePayLogo inverse /></div>
      <div className="workspace"><span className="workspace-icon">EP</span><div><strong>EasePay Workspace</strong><small>Live operations</small></div><ChevronDown size={16}/></div>
      <p className="nav-label">WORKSPACE</p><nav>{navItems.map(({label,icon:Icon})=><button key={label} className={active===label?"nav-item active":"nav-item"} onClick={()=>go(label)}><Icon size={18}/><span>{label}</span>{label==="Payment Proof Review"&&pendingProofs.length>0&&<span className="nav-count">{pendingProofs.length}</span>}{label==="Withdrawal Requests"&&pendingWithdrawals.length>0&&<span className="nav-count">{pendingWithdrawals.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17}/><span><strong>Secure admin session</strong><small>MFA verified · AAL2</small></span></div><div className="profile"><div className="avatar">AD</div><div><strong>Administrator</strong><small>Verified account</small></div><ChevronDown size={16}/></div></div>
    </aside>
    {mobileOpen&&<button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
    <main className="main"><header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="breadcrumbs"><button type="button" className="breadcrumb-home" onClick={()=>setActive("Overview")} aria-label="Go to admin overview">Workspace</button> <span>/</span> <strong>{active}</strong></div><div className="top-actions"><button className="icon-btn" aria-label="Search"><Search size={18}/></button><button className="icon-btn notification" aria-label="Notifications"><Bell size={18}/><i/></button><button className="admin-signout" onClick={()=>supabase.auth.signOut()} title="Sign out"><LogOut size={16}/><span>Sign out</span></button></div></header>
    <div className="page-content"><div className="page-heading"><div><p className="eyebrow">LIVE OPERATIONS</p><h1>{active}</h1><p className="subheading">Live records from the secured EasePay backend.</p></div><button className="date-button" onClick={active==="Customers"?loadCustomers:loadOverview} disabled={loading}><RefreshCw size={15}/> {loading?"Refreshing…":"Refresh"}</button></div>
    {showNotice&&<div className="demo-banner"><ShieldCheck size={18}/><div><strong>Live admin data</strong><span>Amounts and records below are fetched from the production database. Payment proofs are not treated as payment confirmation.</span></div><button onClick={()=>setShowNotice(false)} aria-label="Dismiss"><X size={17}/></button></div>}
    {error&&<div className="proof-error">{error}</div>}
    {active==="Overview"?<>
      <section className="metrics">
        <Metric title="Approved payment records" value={money(totalReceived)} change={proofs.filter(p=>p.status==="approved").length+" proofs"} icon={Wallet} note="Approved payment records"/>
        <Metric title="Customers loaded" value={customers.length.toLocaleString("en-IN")} change="Accounts" icon={Users} note="Loaded from admin customer RPC"/>
        <Metric title="Pending reviews" value={(pendingProofs.length+pendingTopups.length).toString()} change={pendingProofs.length+" proofs · "+pendingTopups.length+" top-ups"} icon={FileCheck} note="Requires admin action"/>
        <Metric title="Withdrawal queue" value={pendingWithdrawals.length.toString()} change="Requested" icon={ArrowUpRight} note="Awaiting review"/>
      </section>
      <section className="content-grid"><div className="panel activity-panel"><div className="panel-heading"><div><h2>Review queue</h2><p>Items needing administrator attention</p></div></div>
        <QueueRow title="Subscription payment proofs" count={pendingProofs.length} route="/admin236794/proofs" icon={FileCheck}/><QueueRow title="Wallet top-ups" count={pendingTopups.length} route="/admin236794/topups" icon={Wallet}/><QueueRow title="Withdrawal requests" count={pendingWithdrawals.length} route="/admin236794/withdrawals" icon={ArrowUpRight}/><div className="activity-footer"><ShieldCheck size={16}/> Approvals require independent bank-credit verification</div>
      </div><div className="panel activity-panel"><div className="panel-heading"><div><h2>System snapshot</h2><p>Operational data</p></div></div><div className="status-row"><span className="status-dot green"/><div><strong>Admin security</strong><small>Allowlist + MFA gate</small></div><span className="status-label">Enabled</span></div><div className="status-row"><span className="status-dot green"/><div><strong>Database</strong><small>Live Supabase records</small></div><span className="status-label">Connected</span></div><div className="status-row"><span className="status-dot amber"/><div><strong>Payment confirmation</strong><small>Manual bank-credit checks</small></div><span className="status-label warning">Manual</span></div><div className="activity-footer"><RefreshCw size={15}/> Last refresh {lastUpdated||"—"}</div></div></section>
      <section className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest submitted/reviewed payment and withdrawal records</p></div><button className="secondary-button" onClick={loadOverview}>Refresh</button></div><ActivityTable rows={recent}/></section>
    </>:active==="Customers"?<section className="panel transactions-panel"><div className="panel-heading transaction-heading"><div><h2>Customer directory</h2><p>Admin RPC results · account and referral overview</p></div><div className="table-actions"><div className="search-field"><Search size={16}/><input placeholder="Search name, email or customer ID" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="secondary-button" onClick={loadCustomers}>Search</button></div></div><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Customer ID</th><th>Referral link</th><th>Referrals</th><th>Qualified</th><th>Rewarded</th></tr></thead><tbody>{customers.map(c=><tr key={c.customer_id}><td><strong>{c.full_name||"Customer"}</strong><small>{c.email||"Email unavailable"}</small></td><td className="id-cell">{c.customer_id}</td><td>{c.referral_code&&!c.link_revoked_at?"Active":c.link_revoked_at?"Revoked":"Not assigned"}</td><td>{c.referral_count||0}</td><td>{c.qualified_count||0}</td><td>{money(Number(c.rewarded_minor||0))}</td></tr>)}</tbody></table>{!loading&&customers.length===0&&<div className="no-results">No customer accounts returned.</div>}</div></section>
    :active==="Audit Logs"?<section className="panel transactions-panel"><div className="panel-heading"><div><h2>Audit trail</h2><p>Latest recorded administrative and system events</p></div><button className="secondary-button" onClick={loadOverview}>Refresh</button></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Actor</th><th>Request ID</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td className="date-cell">{stamp(a.created_at)}</td><td>{a.action}</td><td>{a.target||"—"}</td><td className="id-cell">{a.actor_id||"System"}</td><td className="id-cell">{a.request_id||"—"}</td></tr>)}</tbody></table>{audit.length===0&&<div className="no-results">No audit events available.</div>}</div></section>
    :active==="Payment Settings"?<PaymentSettings/>:active==="Support"?<section className="panel transactions-panel"><div className="panel-heading"><div><h2>Customer support tickets</h2><p>Review customer issues, reply, and update ticket status.</p></div><div className="table-actions"><select className="ticket-filter" value={ticketFilter} onChange={e=>setTicketFilter(e.target.value)}><option value="all">All tickets</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><button className="secondary-button" onClick={loadTickets} disabled={loading}>Refresh</button></div></div><div className="ticket-counts"><span><strong>{tickets.filter(t=>t.status==="open").length}</strong> Open</span><span><strong>{tickets.filter(t=>t.status==="in_progress").length}</strong> In progress</span><span><strong>{tickets.filter(t=>t.status==="resolved").length}</strong> Resolved</span></div>{tickets.length===0&&!loading?<div className="no-results">No support tickets found.</div>:<div className="support-ticket-list">{tickets.map(ticket=><article className="support-ticket-card" key={ticket.id}><div className="support-ticket-head"><div><strong>{ticket.subject}</strong><small>{ticket.customer_email} · {stamp(ticket.created_at)}</small></div><span className={"pill "+ticket.status}>{ticket.status.replace("_"," ")}</span></div><div className="support-ticket-meta"><span>{ticket.category.replace("_"," ")}</span>{ticket.reference_id&&<span>Reference: {ticket.reference_id}</span>}<span className="id-cell">{ticket.id}</span></div><p className="support-ticket-message">{ticket.message}</p>{ticket.admin_reply&&<div className="support-ticket-reply"><strong>Previous reply</strong><p>{ticket.admin_reply}</p><small>{ticket.replied_at?stamp(ticket.replied_at):""}</small></div>}<label className="support-ticket-label">Reply to customer<textarea rows={3} placeholder="Write a response or internal resolution note…" value={ticketReplies[ticket.id]??ticket.admin_reply??""} onChange={e=>setTicketReplies(prev=>({...prev,[ticket.id]:e.target.value}))}/></label><div className="support-ticket-actions"><select value={ticket.status} onChange={e=>setTickets(prev=>prev.map(t=>t.id===ticket.id?{...t,status:e.target.value}:t))}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><button className="secondary-button" onClick={()=>saveTicket(ticket)} disabled={ticketBusy===ticket.id}>{ticketBusy===ticket.id?"Saving…":"Save update"}</button></div></article>)}</div></section> :active==="Transactions"||active==="Settlements"||active==="Accounts"||active==="Settings"?<section className="panel transactions-panel"><div className="panel-heading"><div><h2>{active}</h2><p>Live backend activity for this workspace</p></div></div><ActivityTable rows={recent}/></section>:<section className="panel section-panel"><div className="empty-icon">{navItems.find(n=>n.label===active)?.icon&&(()=>{const I=navItems.find(n=>n.label===active)!.icon;return <I size={24}/>})()}</div><h2>{active}</h2><p>Open the dedicated review module from the sidebar to manage this queue.</p></section>}
    <footer>EasePay admin <span>•</span> Live database records <span>•</span> MFA-protected access{lastUpdated&&<span> • Updated {lastUpdated}</span>}</footer></div></main></div>;
}
function QueueRow({title,count,route,icon:Icon}:{title:string;count:number;route:string;icon:any}){return <button className="status-row queue-row" onClick={()=>window.location.href=route}><Icon size={18}/><div><strong>{title}</strong><small>Open review module</small></div><span className={count>0?"nav-count":"status-label"}>{count}</span></button>}
function ActivityTable({rows}:{rows:{id:string;label:string;customer:string;amount:number;status:string;time:string;type:string}[]}){return <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Record type</th><th>Time</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r.type+r.id}><td className="id-cell">{r.id}</td><td>{r.customer}</td><td>{r.label}</td><td className="date-cell">{stamp(r.time)}</td><td className="amount-cell">{money(r.amount)}</td><td><span className={"pill "+r.status.toLowerCase()}>{r.status}</span></td></tr>)}</tbody></table>{rows.length===0&&<div className="no-results">No recent records.</div>}</div>}
function Metric({title,value,change,icon:Icon,note}:{title:string;value:string;change:string;icon:any;note:string}){return <div className="metric-card"><div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={18}/></div></div><strong className="metric-value">{value}</strong><div className="metric-bottom"><span className="metric-change">{change}</span><span>{note}</span></div></div>}
