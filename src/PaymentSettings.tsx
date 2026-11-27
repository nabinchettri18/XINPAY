import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { loadPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import "./payment-settings.css";
import { AlertTriangle, Copy, Save, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

const defaults: PaymentConfig = {
  upiId:"",beneficiary:"",instructions:"Use the payment details shown here and keep your transaction reference for your records.",enabled:false,
  cryptoEnabled:false,cryptoAsset:"USDT",cryptoNetwork:"TRC20",cryptoAddress:"",
  cryptoInstructions:"Send only USDT on the selected network. Verify the network and address before sending. Payments are manually reviewed."
};
const networks=["TRC20 (Tron)","ERC20 (Ethereum)","BEP20 (BNB Smart Chain)","Polygon","Solana"];

export default function PaymentSettings() {
  const [config,setConfig]=useState<PaymentConfig>(defaults);
  const [saved,setSaved]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const update=(key:keyof PaymentConfig,value:any)=>{setConfig(prev=>({...prev,[key]:value}));setSaved(false);setMessage("");};
  useEffect(()=>{loadPaymentConfig().then(setConfig).finally(()=>setLoading(false))},[]);
  async function saveSettings(){
    const v=config.upiId.trim(),valid=/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(v);
    if(config.enabled&&(!valid||!config.beneficiary.trim())){setSaved(false);setMessage("A valid UPI ID and payee name are required to enable UPI collection.");return}
    if(v&&!valid){setSaved(false);setMessage("Enter a valid UPI ID format.");return}
    if(config.cryptoEnabled&&(!config.cryptoAddress.trim()||config.cryptoAddress.trim().length<20)){setSaved(false);setMessage("Enter a valid receiving address before enabling USDT.");return}
    setSaving(true);
    try{const result=await savePaymentConfig({...config,upiId:v,beneficiary:config.beneficiary.trim(),cryptoAddress:config.cryptoAddress.trim()});setConfig(result);setSaved(true);setMessage("Payment configuration saved to Supabase.");}
    catch(e){setSaved(false);setMessage(e instanceof Error?e.message:"Unable to save settings.")}
    finally{setSaving(false);}
  }
  const qrValue=config.upiId.trim()&&config.beneficiary.trim()?"upi://pay?pa="+encodeURIComponent(config.upiId.trim())+"&pn="+encodeURIComponent(config.beneficiary.trim())+"&cu=INR":"";
  const cryptoQr=config.cryptoAddress.trim()?config.cryptoAddress.trim():"";
  const copy=async(value:string,label:string)=>{try{await navigator.clipboard.writeText(value);setMessage(label+" copied.");setSaved(true);}catch{setMessage("Clipboard access unavailable. Copy the value manually.");setSaved(false);}};
  return <section className="payment-settings-page">
    <div className="payment-settings-head"><div><p className="eyebrow">PAYMENT CONFIGURATION</p><h2>Payment settings</h2><p>Manage the destinations and payment methods shown to customers.</p></div><span className="prototype-tag"><ShieldCheck size={14}/> Supabase connected mode</span></div>
    <div className="payment-warning"><AlertTriangle size={18}/><div><strong>Manual verification required</strong><span>Never approve a payment from a screenshot alone. Verify the actual credit or blockchain transaction independently before approving a customer request.</span></div></div>
    <div className="payment-settings-grid">
      <div className="payment-settings-card">
        <div className="settings-card-title"><div><h3>UPI receiving details</h3><p>Configure the UPI destination shown in the customer checkout.</p></div></div>
        <label className="settings-label">UPI ID<input value={config.upiId} onChange={e=>update("upiId",e.target.value)} placeholder="name@bank" autoComplete="off"/></label>
        <label className="settings-label">Beneficiary / display name<input value={config.beneficiary} onChange={e=>update("beneficiary",e.target.value)} placeholder="Account holder or business name"/></label>
        <label className="settings-label">Customer instructions<textarea rows={3} value={config.instructions} onChange={e=>update("instructions",e.target.value)}/></label>
        <div className="settings-toggle-row"><div><strong>Enable UPI</strong><small>Show UPI as an available checkout method.</small></div><button className={config.enabled?"settings-toggle on":"settings-toggle"} onClick={()=>update("enabled",!config.enabled)} aria-label="Toggle UPI collection">{config.enabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{config.enabled?"Enabled":"Disabled"}</span></button></div>
        <div className="qr-preview">{qrValue?<QRCodeSVG value={qrValue} size={185} level="M" includeMargin/>:<div className="qr-empty"><span>UPI QR preview</span><small>Enter a valid UPI ID and payee name</small></div>}</div>
        <div className="qr-preview-note"><ShieldCheck size={15}/> Preview QR generated from your current UPI details.</div>
      </div>
      <div className="payment-settings-card qr-settings-card">
        <div className="settings-card-title"><div><h3>USDT · Binance / Crypto</h3><p>Manage a receiving wallet address and network for customer display.</p></div></div>
        <label className="settings-label">Asset<select value={config.cryptoAsset} onChange={e=>update("cryptoAsset",e.target.value)}><option value="USDT">USDT (Tether)</option></select></label>
        <label className="settings-label">Network<select value={config.cryptoNetwork} onChange={e=>update("cryptoNetwork",e.target.value)}>{networks.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <label className="settings-label">Receiving address<textarea rows={3} value={config.cryptoAddress} onChange={e=>update("cryptoAddress",e.target.value)} placeholder="Paste the authorized receiving address" autoComplete="off"/></label>
        <button className="upload-qr-button" type="button" disabled={!config.cryptoAddress.trim()} onClick={()=>copy(config.cryptoAddress.trim(),"USDT address")}><Copy size={15}/> Copy receiving address</button>
        <label className="settings-label">Customer instructions<textarea rows={3} value={config.cryptoInstructions} onChange={e=>update("cryptoInstructions",e.target.value)}/></label>
        <div className="settings-toggle-row"><div><strong>Enable USDT checkout</strong><small>Display crypto details to customers when enabled.</small></div><button className={config.cryptoEnabled?"settings-toggle on":"settings-toggle"} onClick={()=>update("cryptoEnabled",!config.cryptoEnabled)} aria-label="Toggle USDT collection">{config.cryptoEnabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{config.cryptoEnabled?"Enabled":"Disabled"}</span></button></div>
        <div className={"qr-preview "+(cryptoQr?"has-image":"")}><div className="qr-preview-inner">{cryptoQr?<QRCodeSVG value={cryptoQr} size={185} level="M" includeMargin/>:<div className="qr-empty"><span>USDT QR preview</span><small>Paste a receiving address to generate QR</small></div>}</div></div>
        <div className="qr-preview-note"><AlertTriangle size={15}/> Customers must use the exact network selected. Network mismatch can result in permanent loss of funds.</div>
        <div className="payment-preview"><span className="preview-label">CUSTOMER PREVIEW</span><strong>{config.cryptoAsset} · {config.cryptoNetwork}</strong><span>{config.cryptoAddress||"Receiving address not configured"}</span><p>{config.cryptoInstructions}</p></div>
      </div>
    </div>
    <div className="payment-settings-card verification-card"><div className="settings-card-title"><div><h3>Payment verification</h3><p>Manual review controls remain in place for both payment methods.</p></div><span className="verification-status">Manual review</span></div><div className="verification-steps"><div><span className="step-number">1</span><div><strong>Confirm destination and amount</strong><small>Check the receiving account or wallet and requested amount.</small></div></div><div><span className="step-number">2</span><div><strong>Verify the transaction independently</strong><small>UPI bank credit or on-chain transaction confirmation, not a screenshot.</small></div></div><div><span className="step-number">3</span><div><strong>Review and audit</strong><small>Record the reference and approval/rejection reason.</small></div></div></div><div className="verification-footer"><AlertTriangle size={16}/> Configuration changes affect customer-facing payment instructions. Verify each saved address carefully.</div></div>
    <div className="payment-settings-savebar"><button className="primary-settings-button" onClick={saveSettings} disabled={loading||saving}><Save size={16}/>{loading?"Loading…":saving?"Saving…":"Save all payment settings"}</button>{message&&<p className={saved?"settings-message success":"settings-message"}>{message}</p>}</div>
  </section>;
}
