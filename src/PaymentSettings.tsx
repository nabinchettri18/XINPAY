import { useState } from "react";
import "./payment-settings.css";
import { AlertTriangle, ImagePlus, Save, ShieldCheck, ToggleLeft, ToggleRight, Upload, X } from "lucide-react";

export default function PaymentSettings() {
  const [upiId, setUpiId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [instructions, setInstructions] = useState("Use the payment details shown here and keep your transaction reference for your records.");
  const [enabled, setEnabled] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrFileName, setQrFileName] = useState("");
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Please select an image file."); return; }
    if (file.size > 3 * 1024 * 1024) { setMessage("Image must be 3 MB or smaller."); return; }
    const next = URL.createObjectURL(file);
    if (qrUrl.startsWith("blob:")) URL.revokeObjectURL(qrUrl);
    setQrUrl(next); setQrFileName(file.name); setSaved(false); setMessage("");
  }

  function saveDemo() {
    setSaved(true);
    setMessage("Preview saved in this session only. Backend persistence and payment verification are not connected.");
  }

  return <section className="payment-settings-page">
    <div className="payment-settings-head">
      <div><p className="eyebrow">PAYMENT CONFIGURATION</p><h2>Payment settings</h2><p>Manage the payment details shown to customers. Live collection is not connected.</p></div>
      <span className="prototype-tag"><ShieldCheck size={14}/> Prototype mode</span>
    </div>
    <div className="payment-warning"><AlertTriangle size={18}/><div><strong>Demo configuration only</strong><span>Changes below are session-only. They do not update a live destination, receive money, or verify payments.</span></div></div>
    <div className="payment-settings-grid">
      <div className="payment-settings-card">
        <div className="settings-card-title"><div><h3>Receiving details</h3><p>Configure the destination shown to customers.</p></div></div>
        <label className="settings-label">UPI ID<input value={upiId} onChange={e=>{setUpiId(e.target.value);setSaved(false)}} placeholder="name@bank" autoComplete="off"/></label>
        <label className="settings-label">Beneficiary / display name<input value={beneficiary} onChange={e=>{setBeneficiary(e.target.value);setSaved(false)}} placeholder="Account holder or business name"/></label>
        <label className="settings-label">Customer instructions<textarea rows={4} value={instructions} onChange={e=>{setInstructions(e.target.value);setSaved(false)}}/></label>
        <div className="settings-toggle-row"><div><strong>Collection display</strong><small>Toggle the payment details panel in this prototype.</small></div><button className={enabled?"settings-toggle on":"settings-toggle"} onClick={()=>{setEnabled(!enabled);setSaved(false)}} aria-label="Toggle collection display">{enabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{enabled?"Enabled":"Disabled"}</span></button></div>
        <button className="primary-settings-button" onClick={saveDemo}><Save size={16}/> Save preview settings</button>
        {message&&<p className={saved?"settings-message success":"settings-message"}>{message}</p>}
      </div>
      <div className="payment-settings-card qr-settings-card">
        <div className="settings-card-title"><div><h3>QR code</h3><p>Upload a QR image to preview how it will appear.</p></div></div>
        <div className={qrUrl?"qr-preview has-image":"qr-preview"}>{qrUrl?<img src={qrUrl} alt="Uploaded payment QR preview"/>:<div className="qr-empty"><ImagePlus size={28}/><span>QR preview</span><small>No image uploaded</small></div>}</div>
        <label className="upload-qr-button"><Upload size={16}/> {qrUrl?"Replace QR image":"Upload QR image"}<input type="file" accept="image/*" onChange={onFile}/></label>
        {qrFileName&&<div className="qr-file-row"><span>{qrFileName}</span><button onClick={()=>{if(qrUrl.startsWith("blob:"))URL.revokeObjectURL(qrUrl);setQrUrl("");setQrFileName("");setSaved(false)}} aria-label="Remove QR"><X size={15}/></button></div>}
        <div className="qr-preview-note"><ShieldCheck size={15}/> Uploaded image is only previewed locally and is not published.</div>
        <div className="payment-preview"><span className="preview-label">CUSTOMER PREVIEW</span><strong>{beneficiary||"Display name"}</strong><span>{upiId||"your-upi-id@bank"}</span><p>{instructions}</p></div>
      </div>
    </div>
    <div className="payment-settings-card verification-card">
      <div className="settings-card-title"><div><h3>Payment verification</h3><p>Verification source must be configured and authorized before live status updates can be enabled.</p></div><span className="verification-status">Not connected</span></div>
      <div className="verification-steps"><div><span className="step-number">1</span><div><strong>Payment confirmation source</strong><small>Provider webhook or authorized reconciliation feed</small></div></div><div><span className="step-number">2</span><div><strong>Server-side validation</strong><small>Validate authenticity, amount, destination, reference and duplicate events</small></div></div><div><span className="step-number">3</span><div><strong>Ledger and audit trail</strong><small>Persist status transitions and administrative actions</small></div></div></div>
      <div className="verification-footer"><AlertTriangle size={16}/> Payments must remain pending until a trusted source confirms receipt.</div>
    </div>
  </section>;
}
