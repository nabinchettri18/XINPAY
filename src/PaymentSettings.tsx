import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { loadPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import { supabase } from "./lib/supabase";
import "./payment-settings.css";
import {
  AlertTriangle, CheckCircle2, ImagePlus, QrCode, Save, ShieldCheck,
  ToggleLeft, ToggleRight, UploadCloud
} from "lucide-react";

const BUCKET = "xinpay-payment-qr";
const MAX_QR_BYTES = 1024 * 1024;
const ACCEPTED_QR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export default function PaymentSettings() {
  const defaults: PaymentConfig = {
    upiId: "",
    beneficiary: "",
    instructions: "Use the payment details shown here and keep your transaction reference for your records.",
    enabled: false,
    qrMode: "generated",
    qrAssetKey: "",
    qrAssetUrl: "",
  };
  const [upiId,setUpiId]=useState(defaults.upiId);
  const [beneficiary,setBeneficiary]=useState(defaults.beneficiary);
  const [instructions,setInstructions]=useState(defaults.instructions);
  const [enabled,setEnabled]=useState(defaults.enabled);
  const [qrMode,setQrMode]=useState<"generated"|"uploaded">("generated");
  const [qrAssetKey,setQrAssetKey]=useState("");
  const [qrAssetUrl,setQrUrl]=useState("");
  const [qrFile,setQrFile]=useState<File|null>(null);
  const [localPreview,setLocalPreview]=useState("");
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [updatedAt,setUpdatedAt]=useState("");

  useEffect(()=>{
    let active=true;
    loadPaymentConfig().then(config=>{
      if(!active)return;
      setUpiId(config.upiId);
      setBeneficiary(config.beneficiary);
      setInstructions(config.instructions);
      setEnabled(config.enabled);
      setQrMode(config.qrMode || "generated");
      setQrAssetKey(config.qrAssetKey || "");
      setQrUrl(config.qrAssetUrl || "");
      setUpdatedAt(config.updatedAt || "");
    }).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(!qrFile){setLocalPreview("");return}
    const url=URL.createObjectURL(qrFile);
    setLocalPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[qrFile]);

  const qrValue=upiId.trim()&&beneficiary.trim()
    ? "upi://pay?pa="+encodeURIComponent(upiId.trim())+"&pn="+encodeURIComponent(beneficiary.trim())+"&cu=INR"
    : "";

  function changed(){setSaved(false);setMessage("")}

  function selectQrFile(file:File|undefined){
    if(!file)return;
    if(!(ACCEPTED_QR_TYPES as readonly string[]).includes(file.type)){
      setQrFile(null);setSaved(false);setMessage("Choose a PNG, JPG or WebP image.");return;
    }
    if(file.size>MAX_QR_BYTES){
      setQrFile(null);setSaved(false);setMessage("The QR image must be 1 MB or smaller.");return;
    }
    setQrFile(file);
    setQrMode("uploaded");
    changed();
  }

  async function saveSettings(){
    const v=upiId.trim();
    const valid=/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(v);
    if(enabled&&(!valid||!beneficiary.trim())){
      setSaved(false);setMessage("A valid UPI ID and payee name are required to enable collection.");return;
    }
    if(v&&!valid){setSaved(false);setMessage("Enter a valid UPI ID format.");return}
    if(qrMode==="uploaded"&&!qrFile&&!qrAssetKey){
      setSaved(false);setMessage("Choose a QR image before saving.");return;
    }
    if(qrMode==="uploaded"&&!supabase){
      setSaved(false);setMessage("Supabase Storage is not configured.");return;
    }

    setSaving(true);setSaved(false);setMessage("");
    let uploadedKey="";
    try{
      let nextKey=qrMode==="uploaded"?qrAssetKey:"";
      if(qrMode==="uploaded"&&qrFile){
        const extension=qrFile.type==="image/png"?"png":qrFile.type==="image/webp"?"webp":"jpg";
        const objectKey="payment-qr/qr-"+crypto.randomUUID()+"."+extension;
        const {data,error}=await supabase!.storage.from(BUCKET).upload(objectKey,qrFile,{
          cacheControl:"60",
          contentType:qrFile.type,
          upsert:false,
        });
        if(error)throw error;
        nextKey=data.path;
        uploadedKey=data.path;
      }

      const next:PaymentConfig={
        upiId:v,
        beneficiary:beneficiary.trim(),
        instructions:instructions.trim(),
        enabled,
        qrMode,
        qrAssetKey:nextKey,
        qrAssetUrl,
      };
      const result=await savePaymentConfig(next);
      setUpiId(result.upiId);
      setBeneficiary(result.beneficiary);
      setInstructions(result.instructions);
      setEnabled(result.enabled);
      setQrMode(result.qrMode || "generated");
      setQrAssetKey(result.qrAssetKey || "");
      setQrUrl(result.qrAssetUrl || "");
      setQrFile(null);
      setUpdatedAt(result.updatedAt || "");
      setSaved(true);
      setMessage("Saved. Customer checkout now uses the updated payment details.");
    }catch(error){
      if(uploadedKey&&supabase){
        const {error:cleanupError}=await supabase.storage.from(BUCKET).remove([uploadedKey]);
        if(cleanupError)console.warn("Uncommitted payment QR cleanup failed:",cleanupError.message);
      }
      setMessage(error instanceof Error?error.message:"Unable to save payment settings.");
    }finally{
      setSaving(false);
    }
  }

  return <section className="payment-settings-page">
    <div className="payment-settings-head">
      <div><p className="eyebrow">PAYMENT CONFIGURATION</p><h2>Payment settings</h2><p>Change the receiving UPI ID and QR. Updates are saved online—no redeploy required.</p></div>
      <span className="prototype-tag"><ShieldCheck size={14}/> Live configuration</span>
    </div>
    <div className="payment-warning">
      <ShieldCheck size={18}/>
      <div><strong>One source of truth</strong><span>Customer checkout reads the saved destination. Changes take effect as soon as they are saved.</span></div>
    </div>

    <div className="payment-settings-grid">
      <div className="payment-settings-card">
        <div className="settings-card-title"><div><h3>Receiving details</h3><p>Set the UPI account customers should pay.</p></div></div>
        <label className="settings-label">UPI ID
          <input value={upiId} onChange={e=>{setUpiId(e.target.value);changed()}} placeholder="name@bank" autoComplete="off" spellCheck={false}/>
        </label>
        <label className="settings-label">Beneficiary / display name
          <input value={beneficiary} onChange={e=>{setBeneficiary(e.target.value);changed()}} placeholder="Account holder or business name"/>
        </label>
        <label className="settings-label">Customer instructions
          <textarea rows={3} maxLength={1000} value={instructions} onChange={e=>{setInstructions(e.target.value);changed()}}/>
        </label>

        <div className="settings-section-label">PAYMENT QR CODE</div>
        <div className="qr-mode-select" role="group" aria-label="QR code type">
          <button type="button" className={qrMode==="generated"?"active":""} onClick={()=>{setQrMode("generated");setQrFile(null);changed()}}>
            <QrCode size={17}/> Generate from UPI ID
          </button>
          <button type="button" className={qrMode==="uploaded"?"active":""} onClick={()=>{setQrMode("uploaded");changed()}}>
            <ImagePlus size={17}/> Upload QR image
          </button>
        </div>
        {qrMode==="uploaded"&&<div className="qr-upload-controls">
          <label className="upload-qr-button"><UploadCloud size={16}/>{qrFile?"Replace selected image":"Choose QR image"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>selectQrFile(e.target.files?.[0])}/>
          </label>
          <p>PNG, JPG or WebP · Maximum 1 MB. Make sure the QR belongs to the same UPI ID and beneficiary above. Older QR files are retained for pending requests.</p>
          {(qrFile||qrAssetKey)&&<div className="qr-file-row"><span>{qrFile?.name || "Saved QR image"}</span><span>{qrFile?"Ready to upload":"Current image"}</span></div>}
        </div>}

        <div className="settings-toggle-row">
          <div><strong>Show payment details to customers</strong><small>Hide or display the receiving UPI details and QR.</small></div>
          <button type="button" className={enabled?"settings-toggle on":"settings-toggle"} onClick={()=>{setEnabled(!enabled);changed()}} aria-label="Toggle payment details">{enabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{enabled?"Visible":"Hidden"}</span></button>
        </div>
        <button className="primary-settings-button" type="button" onClick={()=>void saveSettings()} disabled={loading||saving}>
          <Save size={16}/> {loading?"Loading settings…":saving?"Saving…":"Save payment settings"}
        </button>
        {message&&<p role="status" className={saved?"settings-message success":"settings-message"}>{saved?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>} {message}</p>}
        {updatedAt&&<p className="settings-updated">Last saved {new Date(updatedAt).toLocaleString("en-IN")}</p>}
      </div>

      <div className="payment-settings-card qr-settings-card">
        <div className="settings-card-title"><div><h3>Customer preview</h3><p>This is what the payment area will display.</p></div></div>
        <div className={"qr-preview "+(qrMode==="uploaded"&&(localPreview||qrAssetUrl)?"has-image":"")}>
          {qrMode==="uploaded"
            ? localPreview||qrAssetUrl
              ? <img src={localPreview||qrAssetUrl} alt="Uploaded customer payment QR"/>
              : <div className="qr-empty"><span>QR preview</span><small>Upload a QR image</small></div>
            : qrValue
              ? <QRCodeSVG value={qrValue} size={190} level="M" includeMargin/>
              : <div className="qr-empty"><span>QR preview</span><small>Enter a valid UPI ID and payee name</small></div>}
        </div>
        <div className="qr-preview-note"><ShieldCheck size={15}/> {qrMode==="uploaded"?"Uploaded QR image":"Generated UPI QR"} · {enabled?"Visible to customers":"Hidden from customers"}</div>
        <div className="payment-preview">
          <span className="preview-label">RECEIVING ACCOUNT</span>
          <strong>{beneficiary||"Display name"}</strong>
          <span>{upiId||"your-upi-id@bank"}</span>
          <p>{instructions}</p>
        </div>
      </div>
    </div>

    <div className="payment-settings-card verification-card">
      <div className="settings-card-title"><div><h3>Payment verification</h3><p>QR display and UPI configuration do not themselves confirm a payment.</p></div><span className="verification-status">Bank reconciliation</span></div>
      <div className="verification-footer"><AlertTriangle size={16}/> Payments remain pending until a trusted provider event or verified bank reconciliation confirms receipt.</div>
    </div>
  </section>;
}
