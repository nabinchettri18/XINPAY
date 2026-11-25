import { useEffect, useMemo, useState } from "react";
import { loadPaymentConfig, subscribePaymentConfig } from "./paymentConfig";
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, ChevronRight, CircleHelp, CreditCard, Eye, EyeOff, Home, LogOut, Plus, Search, Settings, ShieldCheck, Wallet, X, Menu, ReceiptText, Clock3 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import CustomerAuth from "./CustomerAuth";
import { supabase } from "./lib/supabase";
import { apiFetch } from "./lib/api";
import { toAuthUser, type AuthUser } from "./lib/auth";

type Section = "Overview" | "Transactions" | "Payments" | "Payment methods" | "Account setup" | "Profile" | "Help";
type Tx = { id: string; name: string; detail: string; date: string; amount: number; status: "Completed" | "Pending" | "Failed"; kind: "Credit" | "Debit"; icon: string };
const transactions: Tx[] = [
  { id: "XP-241124-001", name: "Cafe Coffee Day", detail: "UPI payment · Chandigarh", date: "Today, 10:42 AM", amount: 280, status: "Completed", kind: "Debit", icon: "☕" },
  { id: "XP-241124-002", name: "Wallet top-up", detail: "Added via UPI", date: "Today, 9:18 AM", amount: 2000, status: "Completed", kind: "Credit", icon: "↗" },
  { id: "XP-231124-003", name: "Metro recharge", detail: "Transit · Chandigarh", date: "Yesterday, 7:35 PM", amount: 150, status: "Completed", kind: "Debit", icon: "M" },
  { id: "XP-231124-004", name: "Online purchase", detail: "Shopping", date: "Yesterday, 3:12 PM", amount: 899, status: "Completed", kind: "Debit", icon: "▣" },
  { id: "XP-201124-005", name: "Wallet top-up", detail: "Added via UPI", date: "20 Nov, 11:06 AM", amount: 1500, status: "Completed", kind: "Credit", icon: "↗" },
  { id: "XP-191124-006", name: "Movie tickets", detail: "Entertainment", date: "19 Nov, 8:14 PM", amount: 640, status: "Pending", kind: "Debit", icon: "▸" },
];
const money = (n:number) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(n);
const nav: {name:Section; icon:any}[] = [{name:"Overview",icon:Home},{name:"Transactions",icon:Activity},{name:"Payments",icon:ArrowUpRight},{name:"Payment methods",icon:CreditCard},{name:"Account setup",icon:ShieldCheck},{name:"Profile",icon:Settings},{name:"Help",icon:CircleHelp}];

export default function CustomerApp() {
  const [authUser,setAuthUser] = useState<AuthUser|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return;}
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active)setAuthUser(toAuthUser(session?.user||null));
    });
    void supabase.auth.getSession().then(({data,error})=>{
      if(active){setAuthUser(error?null:toAuthUser(data.session?.user||null));setAuthLoading(false);}
    }).catch(()=>{if(active){setAuthUser(null);setAuthLoading(false);}});
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  const [section,setSection] = useState<Section>("Overview");
  const [balanceVisible,setBalanceVisible] = useState(true);
  const [notice,setNotice] = useState(true);
  const [toast,setToast] = useState("");
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("All");
  const [selected,setSelected] = useState<Tx|null>(null);
  const [mobileNav,setMobileNav] = useState(false);
  const [accountTier,setAccountTier] = useState("Personal");
  const [accountProfiles,setAccountProfiles] = useState(1);
  const [setupStep,setSetupStep] = useState(1);
  const [paymentConfig,setPaymentConfig] = useState({upiId:"",beneficiary:"",instructions:"",enabled:false});
  useEffect(()=>{const refresh=()=>loadPaymentConfig().then(setPaymentConfig);refresh();return subscribePaymentConfig(refresh)},[]);
  useEffect(()=>{const orderId=new URLSearchParams(window.location.search).get("order_id");if(!orderId)return;const token=sessionStorage.getItem("xinpay_order_token:"+orderId);if(!token){setReturnStatus("Order created. Please wait for server-side payment verification.");return;}let cancelled=false;const check=async()=>{try{const r=await apiFetch("/api/orders/"+encodeURIComponent(orderId),{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(!r.ok)throw new Error();const d=await r.json();if(!cancelled)setReturnStatus("Order "+orderId+" status: "+d.status.toUpperCase()+" — only verified server events can confirm payment.");}catch{if(!cancelled)setReturnStatus("We could not verify this order status. Please contact support with order ID "+orderId+".");}};void check();return()=>{cancelled=true}},[]);
  const upiId = paymentConfig.upiId;
  const upiName = paymentConfig.beneficiary;
  const validUpi = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim());
  const [paymentAmount,setPaymentAmount] = useState("");
  const validAmount = /^\d{1,8}(\.\d{1,2})?$/.test(paymentAmount) && Number(paymentAmount)>0;
  const [paymentPurpose,setPaymentPurpose] = useState("");
  const [paymentStep,setPaymentStep] = useState(0);
  const [checkoutBusy,setCheckoutBusy] = useState(false);
  const [checkoutError,setCheckoutError] = useState("");
  const [returnStatus,setReturnStatus] = useState("");
  const [directOrder,setDirectOrder] = useState<any>(null);
  const upiUri = useMemo(()=>`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(paymentAmount)}&cu=INR&tn=${encodeURIComponent(paymentPurpose)}`,[upiId,upiName,paymentAmount,paymentPurpose]);
  async function startCashfreeCheckout(){
    setCheckoutBusy(true);setCheckoutError("");
    try{
      const response=await apiFetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({amount:Number(paymentAmount),purpose:paymentPurpose||"XinPay payment"})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Checkout is currently unavailable");
      if(data.orderId&&data.orderToken)sessionStorage.setItem("xinpay_order_token:"+data.orderId,data.orderToken);
      if(!data.paymentSessionId)throw new Error("Payment session was created but checkout session is missing.");
      const w=window as any;
      if(!w.Cashfree){
        await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src="https://sdk.cashfree.com/js/v3/cashfree.js";script.onload=()=>resolve();script.onerror=()=>reject(new Error("Could not load payment checkout SDK"));document.head.appendChild(script);});
      }
      const cashfree=w.Cashfree({mode:"sandbox"});
      await cashfree.checkout({paymentSessionId:data.paymentSessionId,redirectTarget:"_self"});
    }catch(e){setCheckoutError(e instanceof Error?e.message:"Unable to start checkout");}
    finally{setCheckoutBusy(false);}
  }
async function startDirectUpi(){
    setCheckoutBusy(true);setCheckoutError("");
    try{
      const response=await apiFetch("/api/direct-upi/orders",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({amount:Number(paymentAmount),purpose:paymentPurpose||"XinPay payment"})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Direct UPI is unavailable");
      if(data.orderId&&data.orderToken)sessionStorage.setItem("xinpay_order_token:"+data.orderId,data.orderToken);
      setDirectOrder(data);setPaymentStep(1);
    }catch(e){setCheckoutError(e instanceof Error?e.message:"Unable to create direct UPI order");}
    finally{setCheckoutBusy(false);}
  }
  const showToast=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(""),2600)};
  const go=(s:Section)=>{setSection(s);setMobileNav(false);setSearch("");};
  const filtered=useMemo(()=>transactions.filter(t=>(filter==="All"||t.kind===filter)&&((t.name+" "+t.detail+" "+t.id).toLowerCase().includes(search.toLowerCase()))),[filter,search]);
  const customerInitials=(authUser?.name||"Customer").split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||"").join("");
  async function signOut(){if(!supabase)return;const {error}=await supabase.auth.signOut();if(error){showToast(error.message);return;}setAuthUser(null);}
  const isPasswordRecoveryRoute=window.location.pathname.endsWith("/reset-password");
  if(authLoading)return <div className="xa-loading">Loading your secure XinPay account…</div>;
  if(!authUser||isPasswordRecoveryRoute)return <CustomerAuth onAuthenticated={(user)=>{setAuthUser(user);if(isPasswordRecoveryRoute)window.history.replaceState({},"","/customer");}}/>;
  return <div className="xp-shell">
    <aside className="xp-sidebar">
      <div className="xp-brand"><span className="xp-brand-mark">x</span><span className="xp-brand-word">xinpay<small>PAYMENTS MADE CLEAR</small></span></div>
      <div className="xp-account"><div className="xp-avatar">{customerInitials}</div><div className="xp-account-text"><strong>{authUser.name}</strong><small>{authUser.email}</small></div><ChevronRight size={15}/></div>
      <div className="xp-nav-label">YOUR ACCOUNT</div><nav>{nav.map(({name,icon:Icon})=><button key={name} className={section===name?"xp-nav active":"xp-nav"} onClick={()=>go(name)}><Icon size={18}/><span>{name}</span>{name==="Transactions"&&<small>6</small>}</button>)}</nav>
      <div className="xp-sidebar-bottom"><div className="xp-secure"><ShieldCheck size={17}/><div><strong>Secure by design</strong><small>Demo environment</small></div></div><button className="xp-signout" onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <main className="xp-main">
      <header className="xp-topbar"><button className="xp-mobile-menu" onClick={()=>setMobileNav(!mobileNav)}><Menu size={19}/></button><div className="xp-breadcrumb"><span>Customer portal</span><ChevronRight size={14}/><strong>{section}</strong></div><div className="xp-top-actions"><span className="xp-demo-pill"><i/> DEMO</span><button className="xp-icon-button" onClick={()=>showToast("You're all caught up.")} aria-label="Notifications"><Bell size={18}/></button><div className="xp-avatar small">{customerInitials}</div></div></header>
      {mobileNav&&<div className="xp-mobile-drawer">{nav.map(({name,icon:Icon})=><button key={name} onClick={()=>go(name)} className={section===name?"active":""}><Icon size={18}/>{name}</button>)}</div>}
      <div className="xp-content">{returnStatus&&<div className="xp-demo-banner"><ShieldCheck size={17}/><div><strong>Payment status</strong><span>{returnStatus}</span></div><button onClick={()=>{setReturnStatus("");const u=new URL(window.location.href);u.searchParams.delete("order_id");window.history.replaceState({}, "",u.toString())}} aria-label="Dismiss"><X size={16}/></button></div>}
        {notice&&<div className="xp-demo-banner"><ShieldCheck size={17}/><div><strong>Preview environment</strong><span>Sample balances and transactions. No real money or payment actions are available.</span></div><button onClick={()=>setNotice(false)} aria-label="Dismiss"><X size={16}/></button></div>}
        {section==="Overview"&&<>
          <div className="xp-page-heading"><div><p className="xp-eyebrow">MONDAY, 24 NOVEMBER</p><h1>Welcome back, {authUser.name}</h1><p className="xp-subtitle">Here's a snapshot of your account.</p></div></div>
          <div className="xp-overview-grid">
            <section className="xp-balance-panel"><div className="xp-balance-head"><span>Wallet balance</span><button onClick={()=>setBalanceVisible(!balanceVisible)}>{balanceVisible?<Eye size={16}/>:<EyeOff size={16}/>}<span>{balanceVisible?"Hide":"Show"}</span></button></div><h2>{balanceVisible?"₹12,450.00":"••••••••"}</h2><p>Demo balance · Not withdrawable</p><div className="xp-balance-actions"><button onClick={()=>go("Payments")}><Plus size={16}/> Add money</button><button onClick={()=>go("Payments")}><ArrowUpRight size={16}/> Make payment</button></div><div className="xp-balance-watermark">x</div></section>
            <section className="xp-stat-card"><div className="xp-stat-icon green"><ArrowDownLeft size={18}/></div><span>Money received</span><strong>{balanceVisible?"₹3,500.00":"••••"}</strong><small>Last 7 days <b>+2 entries</b></small></section>
            <section className="xp-stat-card"><div className="xp-stat-icon slate"><ArrowUpRight size={18}/></div><span>Money spent</span><strong>{balanceVisible?"₹1,969.00":"••••"}</strong><small>Last 7 days <b>4 entries</b></small></section>
          </div>
          <section className="xp-quick-card"><div><span className="xp-eyebrow">QUICK ACTIONS</span><h3>What would you like to do?</h3></div><div className="xp-quick-actions"><button onClick={()=>go("Payments")}><span className="xp-quick-icon purple"><ArrowUpRight size={19}/></span><strong>Receive payment</strong><small>Receive via UPI</small></button><button onClick={()=>go("Payments")}><span className="xp-quick-icon green"><Plus size={19}/></span><strong>UPI details</strong><small>Show payment QR</small></button><button onClick={()=>go("Transactions")}><span className="xp-quick-icon grey"><ReceiptText size={19}/></span><strong>View activity</strong><small>Track transactions</small></button><button onClick={()=>go("Account setup")}><span className="xp-quick-icon amber"><ShieldCheck size={19}/></span><strong>Account setup</strong><small>Account options</small></button><button onClick={()=>go("Help")}><span className="xp-quick-icon amber"><CircleHelp size={19}/></span><strong>Get support</strong><small>We're here to help</small></button></div></section>
          <section className="xp-panel"><div className="xp-panel-heading"><div><h3>Recent transactions</h3><p>Your latest account activity</p></div><button className="xp-text-button" onClick={()=>go("Transactions")}>View all <ChevronRight size={15}/></button></div><TransactionList items={transactions.slice(0,4)} onSelect={setSelected}/></section>
        </>}
        {section==="Transactions"&&<><PageHeading title="Transactions" subtitle="Review and search your payment activity."/><section className="xp-panel"><div className="xp-transaction-tools"><div className="xp-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search transactions or ID"/></div><div className="xp-filters">{["All","Credit","Debit"].map(f=><button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><TransactionList items={filtered} onSelect={setSelected}/>{filtered.length===0&&<div className="xp-empty">No matching transactions.</div>}</section></>}
        {section==="Payments"&&<><PageHeading title="Pay securely" subtitle="Sandbox checkout only. No real payments are enabled."/><section className="xp-panel xp-payment-panel"><div className="xp-payment-stepper"><span className={paymentStep>=0?"done":""}>1 <small>Amount</small></span><i/><span className={paymentStep>=1?"done":""}>2 <small>Collect</small></span></div>{paymentStep===0?<div className="xp-payment-form"><label>Amount (INR)<div className="xp-amount-input"><span>₹</span><input value={paymentAmount} onChange={e=>{const v=e.target.value;if(v===""||/^\d{0,8}(\.\d{0,2})?$/.test(v))setPaymentAmount(v)}} type="text" inputMode="decimal" placeholder="0.00" aria-describedby="amount-hint"/></div></label><label>Payment note<input value={paymentPurpose} maxLength={80} onChange={e=>setPaymentPurpose(e.target.value)} placeholder="Optional payment description"/></label><div className="xp-info-note"><ShieldCheck size={17}/><span>Sandbox payment checkout. Payments are disabled unless the server feature flag and sandbox credentials are configured.</span></div><button className="xp-primary" disabled={!validAmount||checkoutBusy} onClick={()=>void startCashfreeCheckout()}>{checkoutBusy?"Opening sandbox checkout…":"Continue to secure checkout"} <ChevronRight size={16}/></button>{checkoutError&&<p className="xp-muted">{checkoutError}</p>}<button className="xp-secondary" style={{marginTop:10,width:"100%"}} disabled={!validAmount||checkoutBusy} onClick={()=>void startDirectUpi()}>Create direct UPI QR (manual verification)</button><p className="xp-muted">Never enter your UPI PIN, OTP, or bank password on XinPay. Provider checkout status is server-verified. Direct UPI orders remain pending until bank reconciliation.</p></div>:<div className="xp-collect-view"><div className="xp-collect-amount">{money(Number(paymentAmount))}</div><p className="xp-collect-purpose">{paymentPurpose||"Payment request"}</p>{directOrder&&<div className="xp-info-note"><ShieldCheck size={17}/><span>Order {directOrder.orderId}. Status remains PENDING until an admin matches the bank credit. Save this order reference.</span></div>}<div className="xp-collect-methods"><div className="xp-collect-method"><span className="xp-method-label">PAY USING UPI ID</span><strong>{directOrder?.upiId||upiId}</strong><button className="xp-secondary" onClick={()=>{navigator.clipboard?.writeText(directOrder?.upiId||upiId);showToast("UPI ID copied.")}}>Copy UPI ID</button><a className="xp-secondary xp-upi-link" href={directOrder?.upiUri||upiUri}>Open UPI app</a></div><div className="xp-qr-demo"><QRCodeSVG value={directOrder?.upiUri||upiUri} size={148} level="M" includeMargin bgColor="#ffffff" fgColor="#14283d"/><strong>Scan with any UPI app</strong><small>{directOrder?"Dynamic order QR · Manual verification":"UPI QR · Payment not verified by XinPay"}</small></div></div><div className="xp-info-note"><ShieldCheck size={17}/><span>This QR encodes your UPI ID and amount. A successful scan or UPI app screen is not proof of payment; verify the credit in your bank account independently.</span></div><button className="xp-secondary" onClick={()=>{setDirectOrder(null);setPaymentStep(0)}}>Change amount</button></div>}</section></>}
        {section==="Account setup"&&<><PageHeading title="Account setup" subtitle="Choose your account type and configure payment preferences."/><section className="xp-panel xp-setup-status"><div className="xp-setup-top"><div><strong>Setup progress</strong><small>Step {setupStep} of 3</small></div><span className="xp-setup-badge">Demo account</span></div><div className="xp-setup-progress"><i style={{width:(setupStep/3*100)+"%"}}/></div><div className="xp-setup-steps"><button className={setupStep>=1?"active":""} onClick={()=>setSetupStep(1)}>1 <span>Account type</span></button><button className={setupStep>=2?"active":""} onClick={()=>setSetupStep(2)}>2 <span>Payment details</span></button><button className={setupStep>=3?"active":""} onClick={()=>setSetupStep(3)}>3 <span>Review</span></button></div></section><div className="xp-tier-grid">{[{name:"Personal",price:"Free",tag:"Everyday",desc:"For individual payments and tracking.",features:["UPI QR & payment details","Transaction history","Basic profile"]},{name:"Business",price:"Free demo",tag:"Business",desc:"For small business payment workflows.",features:["Business payment QR","Payment notes and references","Transaction search"]},{name:"Premium",price:"Coming soon",tag:"Premium",desc:"Advanced features planned for later.",features:["Advanced reporting","Multiple profiles","Priority support (planned)"]}].map(t=><section key={t.name} className={"xp-tier-card "+(accountTier===t.name?"selected":"")}><div className="xp-tier-top"><span>{t.tag}</span>{accountTier===t.name&&<b>Selected</b>}</div><h2>{t.price}</h2><h3>{t.name} account</h3><p>{t.desc}</p><ul>{t.features.map(f=><li key={f}><ShieldCheck size={15}/>{f}</li>)}</ul><button className={accountTier===t.name?"xp-primary":"xp-secondary"} onClick={()=>{setAccountTier(t.name);setSetupStep(2);showToast(t.name+" selected in demo.")}}>{accountTier===t.name?"Selected":"Choose "+t.name}</button></section>)}</div><section className="xp-panel xp-setup-panel"><div className="xp-panel-heading"><div><h3>Payment details</h3><p>Configured UPI information and QR code.</p></div></div>{paymentConfig.enabled&&validUpi?<div className="xp-setup-payment"><QRCodeSVG value={"upi://pay?pa="+encodeURIComponent(upiId)+"&pn="+encodeURIComponent(upiName)+"&cu=INR"} size={150} level="M"/><div><strong>{upiName||"Recipient"}</strong><span>{upiId}</span><button className="xp-secondary" onClick={()=>{navigator.clipboard?.writeText(upiId);showToast("UPI ID copied.")}}>Copy UPI ID</button></div></div>:<div className="xp-info-note"><ShieldCheck size={17}/><span>UPI payment details are not configured or enabled. No payment can be initiated from this screen.</span></div>}<button className="xp-primary" onClick={()=>setSetupStep(3)}>Continue to review</button><p className="xp-muted">Demo setup only. No activation deposits, verification codes, or bank credentials are requested.</p></section><section className="xp-panel xp-account-count"><div><h3>Account profiles</h3><p>Manage profile count in this demo.</p></div><div className="xp-count-controls"><button onClick={()=>setAccountProfiles(Math.max(1,accountProfiles-1))}>−</button><strong>{accountProfiles}</strong><button onClick={()=>setAccountProfiles(Math.min(5,accountProfiles+1))}>+</button></div><small>Up to 5 demo profiles. This does not create real bank accounts.</small></section></>}
        {section==="Payment methods"&&<><PageHeading title="Payment methods" subtitle="Your saved payment methods."/><section className="xp-panel"><div className="xp-method-card"><div className="xp-method-card-top"><span className="xp-method-brand">xinpay</span><span className="xp-demo-pill">DEMO</span></div><div className="xp-card-chip"/><div className="xp-card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;4821</div><div className="xp-method-card-bottom"><span>DEMO CUSTOMER</span><span>VIRTUAL</span></div></div><div className="xp-info-note"><ShieldCheck size={17}/><span>Visual prototype only. This is not a real card and cannot be used to make payments.</span></div><button className="xp-secondary" onClick={()=>showToast("Card management is not connected.")}><Plus size={16}/> Add payment method</button></section></>}
        {section==="Profile"&&<><PageHeading title="Profile & account" subtitle="Manage your personal account details."/><section className="xp-panel"><div className="xp-profile-top"><div className="xp-avatar large">{customerInitials}</div><div><h3>{authUser.name}</h3><p>Verified XinPay customer</p></div></div>{[["Full name",authUser.name],["Email address",authUser.email],["Customer ID",authUser.id],["Account status","Email verified"]].map(([k,v])=><div className="xp-profile-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}<div className="xp-info-note"><ShieldCheck size={17}/><span>Identity verification and profile editing are not connected in this prototype.</span></div></section></>}
        {section==="Help"&&<><PageHeading title="Help & support" subtitle="Find answers and get assistance."/><section className="xp-panel xp-help-list">{[["Transaction issue","Help with a payment, refund or transfer"],["Account & security","Profile, access and account protection"],["Payment methods","Questions about your payment options"],["Contact support","Reach the XinPay support team"]].map(([title,desc])=><button key={title} onClick={()=>showToast("Support is not connected in this demo.")}><span className="xp-help-icon"><CircleHelp size={18}/></span><span><strong>{title}</strong><small>{desc}</small></span><ChevronRight size={17}/></button>)}</section></>}
        <footer className="xp-footer">XinPay <span>·</span> Customer portal <span>·</span> Prototype / sample data</footer>
      </div>
    </main>
    {selected&&<div className="xp-modal-backdrop" onClick={()=>setSelected(null)}><div className="xp-transaction-modal" onClick={e=>e.stopPropagation()}><div className="xp-modal-head"><strong>Transaction details</strong><button onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="xp-modal-amount"><div className="xp-transaction-symbol">{selected.icon}</div><h2 className={selected.kind==="Credit"?"credit":""}>{selected.kind==="Credit"?"+":"−"}{money(selected.amount)}</h2><span className={"xp-status "+selected.status.toLowerCase()}>{selected.status}</span><p>{selected.name}</p></div>{[["Transaction ID",selected.id],["Type",selected.kind],["Date",selected.date],["Description",selected.detail],["Payment status",selected.status]].map(([k,v])=><div className="xp-profile-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}<p className="xp-modal-disclaimer">Sample transaction record — not linked to a real payment.</p></div></div>}
    {toast&&<div className="xp-toast">{toast}</div>}
  </div>;
}
function PageHeading({title,subtitle}:{title:string;subtitle:string}){return <div className="xp-page-heading"><div><h1>{title}</h1><p className="xp-subtitle">{subtitle}</p></div></div>}
function TransactionList({items,onSelect}:{items:Tx[];onSelect:(tx:Tx)=>void}){return <div className="xp-transaction-list">{items.map(t=><button className="xp-transaction-row" key={t.id} onClick={()=>onSelect(t)}><div className="xp-transaction-symbol">{t.icon}</div><div className="xp-transaction-info"><strong>{t.name}</strong><small>{t.detail} <span>·</span> {t.date}</small></div><div className="xp-transaction-value"><strong className={t.kind==="Credit"?"credit":""}>{t.kind==="Credit"?"+":"−"}{money(t.amount)}</strong><small className={"xp-status "+t.status.toLowerCase()}>{t.status}</small></div><ChevronRight className="xp-row-chevron" size={16}/></button>)}</div>}
