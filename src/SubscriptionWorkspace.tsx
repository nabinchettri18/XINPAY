import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, ChevronRight,
  Clock3, Copy, FileImage, Home, LogOut, Menu, ShieldCheck, UploadCloud, UserRound,
  Wallet, X
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { AuthUser } from "./lib/auth";
import "./subscription-workspace.css";

type Section = "Account Setup" | "Overview" | "Payment History" | "Bank Details" | "Profile" | "Pay";
type PlanKey = "starter" | "business" | "premium";
type Plan = { key: PlanKey; name: string; amount: number; description: string; accent: string };
type PaymentSnapshot = { upiId: string; beneficiary: string; qrMode: "generated" | "uploaded"; qrAssetUrl: string; upiUri: string };
type Request = {
  id: string; planKey: PlanKey; planName: string; amountMinor: number; currency: string;
  status: "awaiting_payment" | "submitted" | "approved" | "rejected";
  utr: string | null; adminNote: string | null; createdAt: string; submittedAt: string | null;
  reviewedAt: string | null; payment?: PaymentSnapshot;
};
type Membership = { planKey: PlanKey; planName: string; paidAmountMinor: number; status: string; activationRequestId: string; activatedAt: string };
type BankProfile = {
  bankName: string; accountHolderName: string; accountLast4: string; ifscCode: string;
  upiId: string; qrUrl: string; updatedAt: string; qrAssetKey?: string;
};
type PayState = { request: Request; payment: PaymentSnapshot };
const plans: Plan[] = [
  { key: "starter", name: "Starter", amount: 3598, description: "Entry subscription tier", accent: "gold" },
  { key: "business", name: "Business", amount: 5356, description: "Business subscription tier", accent: "green" },
  { key: "premium", name: "Premium", amount: 9158, description: "Premium subscription tier", accent: "amber" },
];
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const statusLabel: Record<Request["status"], string> = {
  awaiting_payment: "Awaiting payment",
  submitted: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};
const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const proofBucket = "xinpay-subscription-proofs";
const bankQrBucket = "xinpay-customer-bank-qr";

export default function SubscriptionWorkspace({ authUser, onSignOut }: { authUser: AuthUser; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>("Account Setup");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [bankProfile, setBankProfile] = useState<BankProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyPlan, setBusyPlan] = useState<PlanKey | "">("");
  const [pay, setPay] = useState<PayState | null>(null);
  const [utr, setUtr] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [last4, setLast4] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankQr, setBankQr] = useState<File | null>(null);
  const [savingBank, setSavingBank] = useState(false);
  const [bankMessage, setBankMessage] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [subResponse, bankResponse] = await Promise.all([
        apiFetch("/api/customer/subscription", { cache: "no-store" }),
        apiFetch("/api/customer/bank-profile", { cache: "no-store" }),
      ]);
      const subData = await subResponse.json().catch(() => ({}));
      const bankData = await bankResponse.json().catch(() => ({}));
      if (!subResponse.ok) throw new Error(subData.error || "Unable to load your subscription.");
      if (!bankResponse.ok) throw new Error(bankData.error || "Unable to load your bank profile.");
      setMembership(subData.membership || null);
      setRequests(Array.isArray(subData.requests) ? subData.requests : []);
      setBankProfile(bankData.profile || null);
      if (bankData.profile) {
        setBankHolder(bankData.profile.accountHolderName || "");
        setBankName(bankData.profile.bankName || "");
        setIfsc(bankData.profile.ifscCode || "");
        setLast4(bankData.profile.accountLast4 || "");
        setUpiId(bankData.profile.upiId || "");
      }
      if (!pay) {
        if (subData.membership?.status === "active") {
          setSection(bankData.profile ? "Overview" : "Bank Details");
        } else {
          setSection("Account Setup");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your account.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(true); }, []);

  const nav = useMemo(() => membership?.status === "active"
    ? [
        { name: "Overview" as Section, icon: Home },
        { name: "Payment History" as Section, icon: Activity },
        { name: "Bank Details" as Section, icon: Banknote },
        { name: "Profile" as Section, icon: UserRound },
      ]
    : [
        { name: "Account Setup" as Section, icon: Wallet },
        { name: "Payment History" as Section, icon: Activity },
        { name: "Profile" as Section, icon: UserRound },
      ], [membership?.status]);

  function go(next: Section) {
    setSection(next);
    setMobileNav(false);
    if (next !== "Pay") setPay(null);
    setError("");
  }
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function choosePlan(plan: Plan) {
    setBusyPlan(plan.key);
    setError("");
    try {
      const response = await apiFetch("/api/subscription-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: plan.key }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start this plan payment.");
      setPay({ request: data.request, payment: data.payment });
      setUtr("");
      setProofFile(null);
      setProofError("");
      setSection("Pay");
      await refresh();
      setSection("Pay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start this plan payment.");
    } finally {
      setBusyPlan("");
    }
  }

  function continuePayment(request: Request) {
    if (!request.payment) {
      setError("Payment details for this request are unavailable. Start a new request or contact support.");
      return;
    }
    setPay({ request, payment: request.payment });
    setUtr(request.utr || "");
    setProofFile(null);
    setSection("Pay");
  }

  async function submitProof() {
    if (!pay || !supabase || !proofFile) {
      setProofError("Choose your payment screenshot first.");
      return;
    }
    if (!/^[A-Za-z0-9-]{8,35}$/.test(utr.trim())) {
      setProofError("Enter the UTR or transaction reference from your payment app.");
      return;
    }
    if (!imageTypes.includes(proofFile.type) || proofFile.size > 5 * 1024 * 1024) {
      setProofError("Choose a PNG, JPG or WebP screenshot up to 5 MB.");
      return;
    }
    setSubmittingProof(true);
    setProofError("");
    try {
      const ext = proofFile.type === "image/png" ? "png" : proofFile.type === "image/webp" ? "webp" : "jpg";
      const path = authUser.id + "/" + pay.request.id + "/proof-" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage.from(proofBucket).upload(path, proofFile, {
        cacheControl: "60",
        contentType: proofFile.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const response = await apiFetch("/api/subscription-requests/" + encodeURIComponent(pay.request.id) + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: utr.trim(), proofPath: path }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit payment proof.");
      setPay(null);
      setProofFile(null);
      await refresh();
      setSection("Payment History");
      notify("Payment proof submitted for review.");
    } catch (err) {
      setProofError(err instanceof Error ? err.message : "Could not submit payment proof.");
    } finally {
      setSubmittingProof(false);
    }
  }

  async function saveBankProfile() {
    if (!membership || membership.status !== "active") {
      setBankMessage("Your subscription must be activated before adding bank details.");
      return;
    }
    if (!supabase) {
      setBankMessage("Secure file storage is not configured.");
      return;
    }
    if (!bankHolder.trim() || !bankName.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase()) ||
        !/^\d{4}$/.test(last4.trim()) || !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(upiId.trim())) {
      setBankMessage("Check the account holder, bank, IFSC, last four digits and UPI ID.");
      return;
    }
    if (!bankQr && !bankProfile?.qrAssetKey) {
      setBankMessage("Upload the UPI QR that belongs to the bank account entered above.");
      return;
    }

    setSavingBank(true);
    setBankMessage("");
    try {
      let qrAssetKey = bankProfile?.qrAssetKey || "";
      if (bankQr) {
        if (!imageTypes.includes(bankQr.type) || bankQr.size > 2 * 1024 * 1024) {
          throw new Error("Choose a PNG, JPG or WebP QR up to 2 MB.");
        }
        const ext = bankQr.type === "image/png" ? "png" : bankQr.type === "image/webp" ? "webp" : "jpg";
        qrAssetKey = authUser.id + "/profile/qr-" + crypto.randomUUID() + "." + ext;
        const { error: uploadError } = await supabase.storage.from(bankQrBucket).upload(qrAssetKey, bankQr, {
          cacheControl: "60",
          contentType: bankQr.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const response = await apiFetch("/api/customer/bank-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: bankHolder.trim(),
          bankName: bankName.trim(),
          ifscCode: ifsc.trim().toUpperCase(),
          accountLast4: last4.trim(),
          upiId: upiId.trim(),
          qrAssetKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save bank details.");
      setBankQr(null);
      await refresh();
      setSection("Overview");
      setBankMessage("Bank profile saved.");
      notify("Bank details saved.");
    } catch (err) {
      setBankMessage(err instanceof Error ? err.message : "Could not save bank details.");
    } finally {
      setSavingBank(false);
    }
  }

  if (loading) {
    return <div className="xp-sub-loading"><span className="xp-sub-mark">x</span><p>Loading your XinPay account…</p></div>;
  }

  return <div className="xp-shell xp-sub-shell">
    <aside className={mobileNav ? "xp-sidebar open" : "xp-sidebar"}>
      <a className="xp-brand" href="/customer" aria-label="XinPay customer home">
        <span className="xp-brand-mark">x</span><span className="xp-brand-word">xinpay<small>PAYMENTS MADE CLEAR</small></span>
      </a>
      <div className="xp-account">
        <div className="xp-avatar">{authUser.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "X"}</div>
        <div className="xp-account-text"><strong>{authUser.name}</strong><small>{authUser.email}</small></div>
      </div>
      <div className="xp-nav-label">{membership?.status === "active" ? "YOUR ACCOUNT" : "GET STARTED"}</div>
      <nav>{nav.map(({name,icon:Icon})=><button key={name} className={section===name?"xp-nav active":"xp-nav"} onClick={()=>go(name)}><Icon size={18}/><span>{name}</span></button>)}</nav>
      <div className="xp-sidebar-bottom"><button className="xp-signout" onClick={onSignOut}><LogOut size={16}/> Sign out</button></div>
    </aside>

    <main className="xp-main">
      <header className="xp-topbar">
        <button className="xp-mobile-menu" onClick={()=>setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={19}/></button>
        <div className="xp-breadcrumb"><span>XinPay</span><ChevronRight size={14}/><strong>{section==="Pay"?"Plan payment":section}</strong></div>
        <div className="xp-top-actions"><div className="xp-avatar small">{authUser.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "X"}</div><button className="xp-header-signout" onClick={onSignOut}><LogOut size={15}/> Sign out</button></div>
      </header>

      {mobileNav&&<div className="xp-mobile-drawer">{nav.map(({name,icon:Icon})=><button key={name} className={section===name?"active":""} onClick={()=>go(name)}><Icon size={18}/>{name}</button>)}</div>}

      <div className="xp-content xp-sub-content">
        {error&&<div className="xp-sub-alert error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={15}/></button></div>}

        {section==="Account Setup"&&<>
          <div className="xp-sub-heading">
            <p className="xp-eyebrow">ACCOUNT SETUP</p>
            <h1>Choose your XinPay plan.</h1>
            <p>Select one plan to continue. The fee is paid once for account activation.</p>
          </div>
          <div className="xp-plan-grid">
            {plans.map(plan=><article key={plan.key} className={"xp-plan-card "+plan.accent}>
              {plan.key==="starter"&&<span className="xp-plan-tag">START HERE</span>}
              {plan.key==="business"&&<span className="xp-plan-tag">BUSINESS</span>}
              {plan.key==="premium"&&<span className="xp-plan-tag">PREMIUM</span>}
              <p className="xp-plan-kicker">XINPAY SUBSCRIPTION</p>
              <h2>{plan.name}</h2>
              <strong className="xp-plan-price">{money(plan.amount)}</strong>
              <p className="xp-plan-description">{plan.description}</p>
              <div className="xp-plan-divider"/>
              <div className="xp-plan-detail"><CheckCircle2 size={16}/> One-time subscription fee</div>
              <div className="xp-plan-detail"><ShieldCheck size={16}/> Manual payment review</div>
              <button className="xp-plan-button" disabled={busyPlan!==""} onClick={()=>void choosePlan(plan)}>
                {busyPlan===plan.key?"Preparing…":"Pay now"} <ArrowRight size={17}/>
              </button>
            </article>)}
          </div>
          {requests.length>0&&<section className="xp-sub-panel xp-pending-panel">
            <div className="xp-sub-panel-title"><div><p className="xp-eyebrow">YOUR REQUESTS</p><h2>Payment status</h2></div><button className="xp-sub-text-button" onClick={()=>go("Payment History")}>View history <ChevronRight size={15}/></button></div>
            {requests.filter(r=>r.status==="awaiting_payment"||r.status==="submitted").slice(0,3).map(r=><div className="xp-sub-request-line" key={r.id}>
              <div><strong>{r.planName} · {money(r.amountMinor/100)}</strong><small>{r.id} · {statusLabel[r.status]}</small></div>
              {r.status==="awaiting_payment"&&<button className="xp-sub-secondary" onClick={()=>continuePayment(r)}>Continue payment</button>}
            </div>)}
          </section>}
          <p className="xp-sub-footnote">The plan fee is a subscription payment, not a wallet balance or guaranteed return. Account activation follows manual bank-credit verification.</p>
        </>}

        {section==="Pay"&&pay&&<>
          <div className="xp-sub-heading">
            <button className="xp-sub-back" onClick={()=>go("Account Setup")}><ArrowLeft size={15}/> Back to plans</button>
            <p className="xp-eyebrow">PLAN PAYMENT</p>
            <h1>{pay.request.planName}</h1>
            <p>Pay the exact subscription fee to the receiving UPI details below.</p>
          </div>
          <div className="xp-pay-grid">
            <section className="xp-sub-panel xp-pay-destination">
              <div className="xp-sub-panel-title"><div><p className="xp-eyebrow">PAY TO XINPAY</p><h2>Scan to pay</h2></div><span className="xp-sub-status pending">Awaiting payment</span></div>
              <div className="xp-pay-amount">{money(pay.request.amountMinor/100)}</div>
              <div className="xp-pay-qr">
                {pay.payment.qrMode==="uploaded"&&pay.payment.qrAssetUrl
                  ? <img src={pay.payment.qrAssetUrl} alt="XinPay receiving UPI QR"/>
                  : <QRCodeSVG value={pay.payment.upiUri} size={210} level="M" includeMargin/>}
              </div>
              <div className="xp-pay-receiver"><span>Beneficiary</span><strong>{pay.payment.beneficiary}</strong></div>
              <div className="xp-pay-receiver"><span>UPI ID</span><strong>{pay.payment.upiId}</strong></div>
              <button className="xp-sub-copy" onClick={()=>{void navigator.clipboard?.writeText(pay.payment.upiId);notify("UPI ID copied");}}><Copy size={15}/> Copy UPI ID</button>
              <a className="xp-sub-secondary xp-upi-app" href={pay.payment.upiUri}>Open UPI app <ArrowUpRightIcon/></a>
              <p className="xp-sub-footnote">Before paying, verify the payee name and exact amount in your UPI app. Do not share your UPI PIN or OTP.</p>
            </section>

            <section className="xp-sub-panel xp-proof-panel">
              <p className="xp-eyebrow">PAYMENT CONFIRMATION</p>
              <h2>Submit payment proof</h2>
              <p>After completing the UPI payment, enter the UTR and upload the transaction screenshot.</p>
              <label className="xp-sub-field">UTR / Transaction ID
                <input value={utr} onChange={e=>setUtr(e.target.value)} maxLength={35} placeholder="Enter the UTR shown in your UPI app" autoComplete="off"/>
              </label>
              <label className="xp-proof-upload">
                <UploadCloud size={21}/>
                <strong>{proofFile?.name || "Upload payment screenshot"}</strong>
                <small>PNG, JPG or WebP · Up to 5 MB</small>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setProofFile(e.target.files?.[0]||null)}/>
              </label>
              {proofError&&<div className="xp-sub-alert error">{proofError}</div>}
              <button className="xp-sub-primary" disabled={submittingProof||!proofFile||!utr.trim()} onClick={()=>void submitProof()}>
                {submittingProof?"Submitting…":"Submit for verification"} <ArrowRight size={17}/>
              </button>
              <div className="xp-proof-steps"><div><span>01</span>Make the payment</div><div><span>02</span>Enter UTR and screenshot</div><div><span>03</span>Wait for admin verification</div></div>
              <p className="xp-sub-footnote">A screenshot alone does not prove receipt. The request remains pending until an administrator checks the matching bank credit.</p>
            </section>
          </div>
        </>}

        {section==="Overview"&&membership&&<>
          <div className="xp-sub-heading">
            <p className="xp-eyebrow">ACCOUNT OVERVIEW</p>
            <h1>Welcome back, {authUser.name.split(/\s+/)[0]}.</h1>
            <p>Your XinPay account is active.</p>
          </div>
          <div className="xp-membership-grid">
            <section className="xp-membership-card">
              <span>ACTIVE PLAN</span><h2>{membership.planName}</h2><small>Activated {dateLabel(membership.activatedAt)}</small>
            </section>
            <section className="xp-membership-card">
              <span>SUBSCRIPTION AMOUNT RECEIVED</span><strong>{money(membership.paidAmountMinor/100)}</strong><small>Confirmed subscription fee · not a wallet balance</small>
            </section>
            <section className="xp-membership-card">
              <span>ACCOUNT STATUS</span><h2 className="xp-active-label"><CheckCircle2 size={19}/> Active</h2><small>Payment verified by admin</small>
            </section>
          </div>
          {!bankProfile&&<section className="xp-sub-callout"><div><strong>Add your bank details</strong><p>Complete your linked bank and UPI profile to finish account setup.</p></div><button className="xp-sub-primary" onClick={()=>go("Bank Details")}>Add bank details <ArrowRight size={16}/></button></section>}
          <div className="xp-sub-panel xp-overview-history">
            <div className="xp-sub-panel-title"><div><p className="xp-eyebrow">RECENT ACTIVITY</p><h2>Subscription payments</h2></div><button className="xp-sub-text-button" onClick={()=>go("Payment History")}>View all <ChevronRight size={15}/></button></div>
            <RequestList requests={requests.slice(0,4)} onContinue={continuePayment}/>
          </div>
        </>}

        {section==="Payment History"&&<>
          <div className="xp-sub-heading"><p className="xp-eyebrow">PAYMENT HISTORY</p><h1>Your plan requests.</h1><p>Track submitted UTRs and account activation decisions.</p></div>
          <section className="xp-sub-panel"><RequestList requests={requests} onContinue={continuePayment}/></section>
        </>}

        {section==="Bank Details"&&membership?.status==="active"&&<>
          <div className="xp-sub-heading"><p className="xp-eyebrow">LINKED BANK PROFILE</p><h1>Add your bank details.</h1><p>Save the bank and UPI details associated with your account.</p></div>
          <section className="xp-bank-grid">
            <div className="xp-sub-panel">
              <div className="xp-bank-form">
                <label className="xp-sub-field">Account holder name<input value={bankHolder} onChange={e=>setBankHolder(e.target.value)} maxLength={100} placeholder="Name on bank account"/></label>
                <label className="xp-sub-field">Bank name<input value={bankName} onChange={e=>setBankName(e.target.value)} maxLength={100} placeholder="Bank name"/></label>
                <label className="xp-sub-field">IFSC code<input value={ifsc} onChange={e=>setIfsc(e.target.value.toUpperCase())} maxLength={11} placeholder="ABCD0123456" autoCapitalize="characters"/></label>
                <label className="xp-sub-field">Account number — last 4 digits only<input value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} inputMode="numeric" maxLength={4} placeholder="1234"/></label>
                <label className="xp-sub-field">UPI ID<input value={upiId} onChange={e=>setUpiId(e.target.value)} maxLength={256} placeholder="name@bank" autoComplete="off"/></label>
                <label className="xp-proof-upload">
                  <UploadCloud size={21}/><strong>{bankQr?.name|| (bankProfile?.qrAssetKey?"Replace linked account UPI QR":"Upload linked account UPI QR")}</strong>
                  <small>PNG, JPG or WebP · Up to 2 MB</small>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setBankQr(e.target.files?.[0]||null)}/>
                </label>
                {bankProfile?.qrUrl&&!bankQr&&<img className="xp-bank-qr-preview" src={bankProfile.qrUrl} alt="Saved linked bank UPI QR"/>}
                {bankMessage&&<div className="xp-sub-alert">{bankMessage}</div>}
                <button className="xp-sub-primary" disabled={savingBank} onClick={()=>void saveBankProfile()}>{savingBank?"Saving…":"Save bank profile"} <Check size={17}/></button>
              </div>
            </div>
            <aside className="xp-sub-panel xp-bank-note">
              <ShieldCheck size={23}/><h2>Linked account details</h2>
              <p>Only the last four account digits are requested here. Full account numbers are not collected in this setup flow.</p>
              <p>Your UPI QR and UPI ID should belong to the bank account listed in this form.</p>
              <p>Saving these details does not initiate payouts or verify bank ownership.</p>
              {bankProfile&&<div className="xp-bank-saved"><span>Saved profile</span><strong>{bankProfile.bankName}</strong><small>Account ending {bankProfile.accountLast4}</small><small>Updated {dateLabel(bankProfile.updatedAt)}</small></div>}
            </aside>
          </section>
        </>}

        {section==="Profile"&&<>
          <div className="xp-sub-heading"><p className="xp-eyebrow">PROFILE</p><h1>Your account.</h1></div>
          <section className="xp-sub-panel xp-customer-profile">
            <div className="xp-profile-row"><span>Name</span><strong>{authUser.name}</strong></div>
            <div className="xp-profile-row"><span>Email</span><strong>{authUser.email}</strong></div>
            <div className="xp-profile-row"><span>Customer ID</span><strong>{authUser.id}</strong></div>
            <button className="xp-sub-secondary" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
          </section>
        </>}
      </div>
    </main>
    {toast&&<div className="xp-toast">{toast}</div>}
  </div>;
}

function RequestList({requests,onContinue}:{requests:Request[];onContinue:(request:Request)=>void}) {
  if(!requests.length) return <div className="xp-sub-empty"><Activity size={22}/><strong>No plan requests yet</strong><span>Your payment history will appear here after you choose a plan.</span></div>;
  return <div className="xp-request-list">{requests.map(request=><div className="xp-request-row" key={request.id}>
    <div className="xp-request-icon"><Wallet size={17}/></div>
    <div className="xp-request-info"><strong>{request.planName} · {money(request.amountMinor/100)}</strong><small>{request.id} · {dateLabel(request.createdAt)}{request.utr?" · UTR "+request.utr:""}</small>{request.adminNote&&<small>Admin note: {request.adminNote}</small>}</div>
    <span className={"xp-sub-status "+request.status}>{statusLabel[request.status]}</span>
    {request.status==="awaiting_payment"&&request.payment&&<button className="xp-sub-text-button" onClick={()=>onContinue(request)}>Pay <ArrowRight size={14}/></button>}
  </div>)}</div>;
}

function ArrowUpRightIcon() {
  return <ArrowRight size={15}/>;
}
