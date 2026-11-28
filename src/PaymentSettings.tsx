import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { loadPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import "./payment-settings.css";
import { AlertTriangle, Save, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

export default function PaymentSettings() {
  const defaults: PaymentConfig = { upiId:"", beneficiary:"", instructions:"Use the payment details shown here and keep your transaction reference for your records.", enabled:false, cryptoEnabled:false, cryptoAsset:"USDT", cryptoNetwork:"TRON (TRC20)", cryptoWalletAddress:"", cryptoMemo:"", cryptoInstructions:"Send only the selected asset on the selected network. Confirm the address and network before sending." };
  const [upiId,setUpiId]=useState(defaults.upiId);
  const [beneficiary,setBeneficiary]=useState(defaults.beneficiary);
  const [instructions,setInstructions]=useState(defaults.instructions);
  const [enabled,setEnabled]=useState(defaults.enabled);\n  const [cryptoEnabled,setCryptoEnabled]=useState(defaults.cryptoEnabled);\n  const [cryptoAsset,setCryptoAsset]=useState(defaults.cryptoAsset);\n  const [cryptoNetwork,setCryptoNetwork]=useState(defaults.cryptoNetwork);\n  const [cryptoWalletAddress,setCryptoWalletAddress]=useState(defaults.cryptoWalletAddress);\n  const [cryptoMemo,setCryptoMemo]=useState(defaults.cryptoMemo);\n  const [cryptoInstructions,setCryptoInstructions]=useState(defaults.cryptoInstructions);
  const [saved,setSaved]=useState(false);
  const [message,setMessage]=useState("");

  const [loading,setLoading]=useState(true);
  useEffect(()=>{loadPaymentConfig().then(c=>{setUpiId(c.upiId);setBeneficiary(c.beneficiary);setInstructions(c.instructions);setEnabled(c.enabled);setCryptoEnabled(c.cryptoEnabled);setCryptoAsset(c.cryptoAsset);setCryptoNetwork(c.cryptoNetwork);setCryptoWalletAddress(c.cryptoWalletAddress);setCryptoMemo(c.cryptoMemo);setCryptoInstructions(c.cryptoInstructions)}).finally(()=>setLoading(false))},[]);
  async function saveSettings(){
    const v=upiId.trim(),valid=/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(v);
    if(enabled&&(!valid||!beneficiary.trim())){setSaved(false);setMessage("A valid UPI ID and payee name are required to enable collection.");return}
    if(v&&!valid){setSaved(false);setMessage("Enter a valid UPI ID format.");return}
    const next:PaymentConfig={upiId:v,beneficiary:beneficiary.trim(),instructions,enabled,cryptoEnabled,cryptoAsset:cryptoAsset.trim(),cryptoNetwork,cryptoWalletAddress:cryptoWalletAddress.trim(),cryptoMemo:cryptoMemo.trim(),cryptoInstructions};
    try{const result=await savePaymentConfig(next);setUpiId(result.upiId);setBeneficiary(result.beneficiary);setInstructions(result.instructions);setEnabled(result.enabled);setCryptoEnabled(result.cryptoEnabled);setCryptoAsset(result.cryptoAsset);setCryptoNetwork(result.cryptoNetwork);setCryptoWalletAddress(result.cryptoWalletAddress);setCryptoMemo(result.cryptoMemo);setCryptoInstructions(result.cryptoInstructions);setSaved(true);setMessage("Payment configuration saved to backend.");}
    catch(e){setSaved(false);setMessage(e instanceof Error?e.message:"Unable to save settings.")}
  }
  const qrValue=upiId.trim()&&beneficiary.trim()?"upi://pay?pa="+encodeURIComponent(upiId.trim())+"&pn="+encodeURIComponent(beneficiary.trim())+"&cu=INR":"";
  return <section className="payment-settings-page">
    <div className="payment-settings-head"><div><p className="eyebrow">PAYMENT CONFIGURATION</p><h2>Payment settings</h2><p>Manage the payment destination displayed to customers.</p></div><span className="prototype-tag"><ShieldCheck size={14}/> Supabase connected mode</span></div>
    <div className="payment-warning"><AlertTriangle size={18}/><div><strong>UPI configuration is backend-managed</strong><span>Settings are saved to Supabase. Payment verification is manual; do not treat QR scans or screenshots as proof of payment.</span></div></div>
    <div className="payment-settings-grid">
      <div className="payment-settings-card">
        <div className="settings-card-title"><div><h3>Receiving details</h3><p>Configure the destination shown to customers.</p></div></div>
        
        <label className="settings-label">UPI ID<input value={upiId} onChange={e=>{setUpiId(e.target.value);setSaved(false)}} placeholder="name@bank" autoComplete="off"/></label>
        <label className="settings-label">Beneficiary / display name<input value={beneficiary} onChange={e=>{setBeneficiary(e.target.value);setSaved(false)}} placeholder="Account holder or business name"/></label>
        <label className="settings-label">Customer instructions<textarea rows={4} value={instructions} onChange={e=>{setInstructions(e.target.value);setSaved(false)}}/></label>
        <div className="settings-toggle-row"><div><strong>Collection display</strong><small>Show or hide UPI collection in customer portal.</small></div><button className={enabled?"settings-toggle on":"settings-toggle"} onClick={()=>{setEnabled(!enabled);setSaved(false)}} aria-label="Toggle collection display">{enabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{enabled?"Enabled":"Disabled"}</span></button></div>
        <button className="primary-settings-button" onClick={saveSettings} disabled={loading}><Save size={16}/> {loading?"Loading settings…":"Save payment settings"}</button>
        {message&&<p className={saved?"settings-message success":"settings-message"}>{message}</p>}
      </div>
      <div className="payment-settings-card qr-settings-card"><div className="settings-card-title"><div><h3>Dynamic UPI QR</h3><p>Preview generated from the receiving details.</p></div></div>
        <div className="qr-preview">{qrValue?<QRCodeSVG value={qrValue} size={190} level="M" includeMargin/>:<div className="qr-empty"><span>QR preview</span><small>Enter UPI ID and payee name</small></div>}</div>
        <div className="qr-preview-note"><ShieldCheck size={15}/> QR preview updates as you edit. Saved configuration is fetched by customers from Supabase.</div>
        <div className="payment-preview"><span className="preview-label">CUSTOMER PREVIEW</span><strong>{beneficiary||"Display name"}</strong><span>{upiId||"your-upi-id@bank"}</span><p>{instructions}</p></div>
      </div>
    </div>
    <div className="payment-settings-card crypto-settings-card">
      <div className="settings-card-title"><div><h3>Binance / crypto wallet deposits</h3><p>Configure manual wallet deposits. This does not connect to Binance Pay or automatically verify transactions.</p></div><span className="verification-status">Manual verification</span></div>
      <div className="settings-toggle-row"><div><strong>Enable crypto deposit display</strong><small>Display configured deposit details to customers.</small></div><button className={cryptoEnabled?"settings-toggle on":"settings-toggle"} onClick={()=>{setCryptoEnabled(!cryptoEnabled);setSaved(false)}} aria-label="Toggle crypto deposit display">{cryptoEnabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{cryptoEnabled?"Enabled":"Disabled"}</span></button></div>
      <div className="payment-settings-grid crypto-fields-grid">
        <label className="settings-label">Asset / token<input value={cryptoAsset} onChange={e=>{setCryptoAsset(e.target.value.toUpperCase());setSaved(false)}} placeholder="USDT" maxLength={12}/></label>
        <label className="settings-label">Network<select value={cryptoNetwork} onChange={e=>{setCryptoNetwork(e.target.value);setSaved(false)}}><option>TRON (TRC20)</option><option>Ethereum (ERC20)</option><option>BNB Smart Chain (BEP20)</option><option>Solana</option><option>Bitcoin</option><option>Other / custom</option></select></label>
      </div>
      <label className="settings-label">Wallet deposit address<textarea rows={2} value={cryptoWalletAddress} onChange={e=>{setCryptoWalletAddress(e.target.value);setSaved(false)}} placeholder="Paste the receiving wallet address" autoComplete="off" spellCheck={false}/></label>
      <label className="settings-label">Memo / tag (if required)<input value={cryptoMemo} onChange={e=>{setCryptoMemo(e.target.value);setSaved(false)}} placeholder="Leave blank if network does not require it"/></label>
      <label className="settings-label">Customer deposit instructions<textarea rows={4} value={cryptoInstructions} onChange={e=>{setCryptoInstructions(e.target.value);setSaved(false)}}/></label>
      <div className="payment-warning"><AlertTriangle size={18}/><div><strong>Network and address safety</strong><span>Customers must use the exact asset and network shown. Crypto transfers may be irreversible. Deposits remain pending until an administrator independently verifies the transaction on the network.</span></div></div>
      <button className="primary-settings-button" onClick={saveSettings} disabled={loading}><Save size={16}/> Save crypto deposit settings</button>
      {message&&<p className={saved?"settings-message success":"settings-message"}>{message}</p>}
    </div>
    <div className="payment-settings-card verification-card"><div className="settings-card-title"><div><h3>Payment verification</h3><p>Payment confirmation remains disabled until a trusted source is connected.</p></div><span className="verification-status">Not connected</span></div><div className="verification-steps"><div><span className="step-number">1</span><div><strong>Payment confirmation source</strong><small>Provider webhook or authorized reconciliation feed</small></div></div><div><span className="step-number">2</span><div><strong>Server-side validation</strong><small>Validate authenticity, amount, destination, reference and duplicate events</small></div></div><div><span className="step-number">3</span><div><strong>Ledger and audit trail</strong><small>Persist status transitions and administrative actions</small></div></div></div><div className="verification-footer"><AlertTriangle size={16}/> Payments must remain pending until a trusted source confirms receipt.</div></div>
  </section>;
}
