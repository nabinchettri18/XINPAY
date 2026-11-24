import { useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, ChevronRight, CircleHelp, CreditCard, Eye, EyeOff, Home, LogOut, Plus, Settings, ShieldCheck, Wallet } from "lucide-react";

type Section = "Home" | "Activity" | "Cards" | "Profile";
const activity = [
  { name: "Cafe Coffee Day", date: "Today · 10:42 AM", amount: "-₹280.00", status: "Completed", icon: "☕" },
  { name: "Wallet top-up", date: "Today · 9:18 AM", amount: "+₹2,000.00", status: "Completed", icon: "↗" },
  { name: "Metro recharge", date: "Yesterday · 7:35 PM", amount: "-₹150.00", status: "Completed", icon: "🚇" },
  { name: "Online purchase", date: "Yesterday · 3:12 PM", amount: "-₹899.00", status: "Completed", icon: "🛍" },
  { name: "Wallet top-up", date: "20 Nov · 11:06 AM", amount: "+₹1,500.00", status: "Completed", icon: "↗" }
];
export default function CustomerApp() {
  const [section, setSection] = useState<Section>("Home");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [notice, setNotice] = useState(true);
  const [toast, setToast] = useState("");
  const showToast = (message:string) => { setToast(message); window.setTimeout(()=>setToast(""),2500); };
  return <div className="customer-shell">
    <aside className="customer-sidebar">
      <div className="customer-brand"><span className="customer-logo">X</span><span>xinpay<small>YOUR MONEY. YOUR CONTROL.</small></span></div>
      <div className="customer-user"><div className="customer-avatar">NC</div><div><strong>Nabin Chettri</strong><small>Personal account</small></div></div>
      <nav>{(["Home","Activity","Cards","Profile"] as Section[]).map((item,i)=>{const Icon=[Home,ActivityIcon,CreditCard,Settings][i];return <button key={item} className={section===item?"customer-nav active":"customer-nav"} onClick={()=>setSection(item)}><Icon size={18}/>{item}</button>})}</nav>
      <div className="customer-sidebar-footer"><ShieldCheck size={17}/><div><strong>Protected account</strong><small>Demo experience</small></div></div>
    </aside>
    <main className="customer-main">
      <header className="customer-top"><div className="customer-greeting"><span>Good evening,</span><strong>Nabin 👋</strong></div><button className="customer-icon-btn" onClick={()=>showToast("You are all caught up.")}><Bell size={18}/><i/></button></header>
      <div className="customer-content">
        {notice&&<div className="customer-demo-notice"><ShieldCheck size={17}/><span><strong>Demo customer portal</strong> All balances and activity are sample data. No real funds or payment actions are available.</span><button onClick={()=>setNotice(false)}>×</button></div>}
        {section==="Home"&&<>
          <section className="customer-balance-card"><div className="balance-card-top"><span>Available balance</span><button onClick={()=>setBalanceVisible(!balanceVisible)}>{balanceVisible?<Eye size={17}/>:<EyeOff size={17}/>}</button></div><div className="customer-balance">{balanceVisible?"₹12,450.00":"••••••••"}</div><div className="balance-label">Demo balance · Not withdrawable</div><div className="balance-card-actions"><button onClick={()=>showToast("Wallet funding is disabled in this demo.")}><Plus size={16}/> Add money</button><button onClick={()=>showToast("Transfers are disabled in this demo.")}><ArrowUpRight size={16}/> Send</button></div><div className="balance-card-watermark">X</div></section>
          <div className="customer-quick-actions"><button onClick={()=>showToast("Payments are disabled in this demo.")}><span><ArrowUpRight/></span>Pay</button><button onClick={()=>showToast("Add money is disabled in this demo.")}><span><Plus/></span>Add money</button><button onClick={()=>setSection("Activity")}><span><ActivityIcon/></span>History</button><button onClick={()=>showToast("Help center coming soon.")}><span><CircleHelp/></span>Help</button></div>
          <section className="customer-section"><div className="customer-section-heading"><div><h2>Recent activity</h2><p>Your latest wallet activity</p></div><button onClick={()=>setSection("Activity")}>View all <ChevronRight size={16}/></button></div><div className="customer-activity-list">{activity.slice(0,4).map((a,i)=><ActivityRow key={i} item={a}/>)}</div></section>
          <section className="customer-promo"><div><span className="promo-label">XINPAY</span><h3>Payments, made simple.</h3><p>One place to view your payment activity.</p></div><div className="promo-art">✦</div></section>
        </>}
        {section==="Activity"&&<section className="customer-section standalone"><div className="customer-section-heading"><div><h2>Transaction history</h2><p>Demo records · newest first</p></div></div><div className="customer-activity-list">{activity.map((a,i)=><ActivityRow key={i} item={a}/>)}</div></section>}
        {section==="Cards"&&<section className="customer-section standalone"><div className="customer-section-heading"><div><h2>My payment methods</h2><p>Manage payment methods</p></div></div><div className="customer-card-visual"><div className="card-top"><span>XINPAY</span><span>DEMO</span></div><div className="card-chip"/><div className="card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;4821</div><div className="card-bottom"><span>NABIN CHETTRI</span><span>VIRTUAL</span></div></div><div className="customer-info-box"><ShieldCheck size={18}/><span>This is a visual demo card. It is not a real payment card and cannot be used to transact.</span></div><button className="customer-outline-button" onClick={()=>showToast("Card issuing is not enabled.")}><Plus size={17}/> Add payment method</button></section>}
        {section==="Profile"&&<section className="customer-section standalone"><div className="customer-section-heading"><div><h2>Account profile</h2><p>Your personal information</p></div></div><div className="profile-detail"><div className="customer-avatar large">NC</div><strong>Nabin Chettri</strong><span>Demo customer</span></div>{[["Full name","Nabin Chettri"],["Email","nabin@example.com"],["Phone","+91 •••••• 4821"],["Account ID","XP-DEMO-001"]].map(([k,v])=><div className="profile-field" key={k}><span>{k}</span><strong>{v}</strong></div>)}<div className="customer-info-box"><ShieldCheck size={18}/><span>Profile editing and identity verification are not connected in this prototype.</span></div><button className="customer-outline-button" onClick={()=>showToast("Sign out is not connected in this demo.")}><LogOut size={17}/> Sign out</button></section>}
        <footer className="customer-footer">XinPay Customer · Prototype <span>•</span> Sample data only</footer>
      </div>
    </main>
    {toast&&<div className="customer-toast">{toast}</div>}
  </div>;
}
function ActivityIcon(){return <Activity/>}
function ActivityRow({item}:{item:typeof activity[number]}){const incoming=item.amount.startsWith("+");return <div className="customer-activity-row"><div className="activity-symbol">{item.icon}</div><div className="activity-info"><strong>{item.name}</strong><small>{item.date}</small></div><div className="activity-amount"><strong className={incoming?"incoming":""}>{item.amount}</strong><small>{item.status}</small></div></div>}
