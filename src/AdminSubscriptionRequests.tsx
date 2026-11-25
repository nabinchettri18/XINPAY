import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./lib/api";
import {
  AlertTriangle, CheckCircle2, Clock3, Image as ImageIcon, RefreshCw,
  Search, ShieldCheck, XCircle
} from "lucide-react";

type ReviewStatus = "awaiting_payment" | "submitted" | "approved" | "rejected";
type SubscriptionRequest = {
  id: string;
  customerId: string;
  customerEmail: string;
  planKey: string;
  planName: string;
  amountMinor: number;
  currency: string;
  status: ReviewStatus;
  receiverUpiId: string;
  receiverBeneficiary: string;
  utr: string | null;
  proofUrl: string;
  submittedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-IN") : "—";
const statusNames: Record<ReviewStatus,string> = {
  awaiting_payment: "Awaiting payment",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export default function AdminSubscriptionRequests() {
  const [requests,setRequests]=useState<SubscriptionRequest[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("submitted");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<SubscriptionRequest|null>(null);
  const [confirmBankCredit,setConfirmBankCredit]=useState(false);
  const [adminNote,setAdminNote]=useState("");
  const [busy,setBusy]=useState<"approve"|"reject"|null>(null);
  const [message,setMessage]=useState("");

  async function load() {
    setError("");
    setRefreshing(true);
    try {
      const response=await apiFetch("/api/admin/subscription-requests",{cache:"no-store"});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Could not load subscription requests.");
      const rows=Array.isArray(data.requests)?data.requests:[];
      setRequests(rows);
      if(selected) {
        const current=rows.find((row:SubscriptionRequest)=>row.id===selected.id);
        setSelected(current||null);
      }
    } catch(err) {
      setError(err instanceof Error?err.message:"Could not load subscription requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(()=>{void load()},[]);

  const counts=useMemo(()=>({
    submitted:requests.filter(r=>r.status==="submitted").length,
    awaiting_payment:requests.filter(r=>r.status==="awaiting_payment").length,
    approved:requests.filter(r=>r.status==="approved").length,
    rejected:requests.filter(r=>r.status==="rejected").length,
  }),[requests]);

  const filtered=useMemo(()=>requests.filter(r=>
    (filter==="all"||r.status===filter) &&
    [r.id,r.customerEmail,r.customerId,r.utr||"",r.planName].join(" ").toLowerCase().includes(search.toLowerCase())
  ),[requests,filter,search]);

  async function review(decision:"approve"|"reject") {
    if(!selected)return;
    if(decision==="approve"&&!confirmBankCredit)return;
    setBusy(decision);setError("");setMessage("");
    try {
      const response=await apiFetch("/api/admin/subscription-requests/"+encodeURIComponent(selected.id)+"/review",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({decision,adminNote,confirmBankCredit}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Could not review this request.");
      setMessage(decision==="approve"?"Payment approved. Customer account activated.":"Request rejected.");
      setSelected(null);
      setConfirmBankCredit(false);
      setAdminNote("");
      await load();
    } catch(err) {
      setError(err instanceof Error?err.message:"Could not review this request.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="xsr-page">
    <div className="xsr-heading">
      <div><p className="eyebrow">MANUAL PAYMENT REVIEW</p><h2>Subscription requests</h2><p>Review the UTR and screenshot, then confirm the matching bank credit before activating an account.</p></div>
      <button className="xsr-refresh" onClick={()=>void load()} disabled={refreshing}><RefreshCw size={15}/> {refreshing?"Refreshing…":"Refresh"}</button>
    </div>

    <div className="xsr-metrics">
      <div><span>Needs review</span><strong>{counts.submitted}</strong></div>
      <div><span>Awaiting payment</span><strong>{counts.awaiting_payment}</strong></div>
      <div><span>Approved</span><strong>{counts.approved}</strong></div>
      <div><span>Rejected</span><strong>{counts.rejected}</strong></div>
    </div>

    {message&&<div className="xsr-message success"><CheckCircle2 size={16}/>{message}</div>}
    {error&&<div className="xsr-message error"><AlertTriangle size={16}/>{error}</div>}

    <div className="xsr-toolbar">
      <label className="xsr-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer, UTR or request ID"/></label>
      <div className="xsr-filters">
        {["submitted","awaiting_payment","approved","rejected","all"].map(value=><button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{value==="all"?"All":statusNames[value as ReviewStatus]}</button>)}
      </div>
    </div>

    {loading?<div className="xsr-empty">Loading subscription requests…</div>:
      filtered.length===0?<div className="xsr-empty"><ImageIcon size={24}/><strong>No matching requests</strong><span>Requests submitted by customers will appear here.</span></div>:
      <div className="xsr-list">{filtered.map(request=><button key={request.id} className={"xsr-row "+(selected?.id===request.id?"selected":"")} onClick={()=>{setSelected(request);setConfirmBankCredit(false);setAdminNote(request.adminNote||"");setMessage("");}}>
        <span className="xsr-row-icon">{request.status==="approved"?<CheckCircle2/>:request.status==="rejected"?<XCircle/>:<Clock3/>}</span>
        <span className="xsr-row-main"><strong>{request.customerEmail||request.customerId}</strong><small>{request.planName} · {request.id}</small><small>{request.utr?"UTR "+request.utr:"UTR not submitted"} · {date(request.submittedAt||request.createdAt)}</small></span>
        <span className="xsr-row-amount"><strong>{money(request.amountMinor)}</strong><small className={"xsr-status "+request.status}>{statusNames[request.status]}</small></span>
      </button>)}</div>
    }

    {selected&&<div className="xsr-detail-backdrop" onClick={()=>setSelected(null)}>
      <section className="xsr-detail" onClick={e=>e.stopPropagation()}>
        <header><div><p className="eyebrow">REQUEST DETAILS</p><h3>{selected.planName} · {money(selected.amountMinor)}</h3></div><button onClick={()=>setSelected(null)} aria-label="Close request"><XCircle size={20}/></button></header>
        <div className="xsr-detail-grid">
          <div><span>Customer</span><strong>{selected.customerEmail||selected.customerId}</strong></div>
          <div><span>Request ID</span><strong>{selected.id}</strong></div>
          <div><span>Submitted</span><strong>{date(selected.submittedAt)}</strong></div>
          <div><span>UTR / transaction ID</span><strong className="xsr-utr">{selected.utr||"Not submitted"}</strong></div>
          <div><span>Paid to</span><strong>{selected.receiverBeneficiary}</strong></div>
          <div><span>Receiving UPI ID</span><strong>{selected.receiverUpiId}</strong></div>
        </div>
        {selected.proofUrl?<div className="xsr-proof"><span>PAYMENT SCREENSHOT</span><a href={selected.proofUrl} target="_blank" rel="noreferrer"><img src={selected.proofUrl} alt="Customer payment proof"/></a><a className="xsr-open-proof" href={selected.proofUrl} target="_blank" rel="noreferrer">Open full screenshot</a></div>:<div className="xsr-no-proof">No payment screenshot uploaded.</div>}
        {selected.status==="submitted"?<>
          <label className="xsr-note">Admin note (optional)<textarea rows={2} maxLength={1000} value={adminNote} onChange={e=>setAdminNote(e.target.value)} placeholder="Add a review note for the customer"/></label>
          <label className="xsr-confirm"><input type="checkbox" checked={confirmBankCredit} onChange={e=>setConfirmBankCredit(e.target.checked)}/><span><strong>I verified the bank credit.</strong><small>I checked the receiving bank statement, matching UTR and exact amount of {money(selected.amountMinor)}. I am not approving based on the screenshot alone.</small></span></label>
          <div className="xsr-actions">
            <button className="xsr-reject" disabled={!!busy} onClick={()=>void review("reject")}>{busy==="reject"?"Rejecting…":"Reject request"}</button>
            <button className="xsr-approve" disabled={!confirmBankCredit||!!busy} onClick={()=>void review("approve")}>{busy==="approve"?"Approving…":"Confirm payment & activate"}</button>
          </div>
        </>:<div className="xsr-reviewed"><ShieldCheck size={17}/><span>This request is {statusNames[selected.status].toLowerCase()}{selected.reviewedAt?" · "+date(selected.reviewedAt):""}.</span></div>}
      </section>
    </div>}
  </section>;
}
