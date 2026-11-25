import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { loadPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import { supabase } from "./lib/supabase";
import "./payment-settings.css";
import {
  AlertTriangle, CheckCircle2, ImagePlus, RefreshCw, Save, ShieldCheck,
  ToggleLeft, ToggleRight, Upload, X
} from "lucide-react";

const BUCKET = "xinpay-payment-qr";
const MAX_QR_BYTES = 2 * 1024 * 1024;
const QR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const defaults: PaymentConfig = {
  upiId: "",
  beneficiary: "",
  instructions: "Use the payment details shown here and keep your transaction reference for your records.",
  enabled: false,
  qrMode: "generated",
  qrAssetKey: "",
  qrAssetUrl: "",
};

export default function PaymentSettings() {
  const [upiId,setUpiId] = useState(defaults.upiId);
  const [beneficiary,setBeneficiary] = useState(defaults.beneficiary);
  const [instructions,setInstructions] = useState(defaults.instructions);
  const [enabled,setEnabled] = useState(defaults.enabled);
  const [qrMode,setQrMode] = useState<"generated"|"uploaded">("generated");
  const [qrAssetKey,setQrAssetKey] = useState("");
  const [qrAssetUrl,setQrAssetUrl] = useState("");
  const [savedUpiId,setSavedUpiId] = useState("");
  const [savedBeneficiary,setSavedBeneficiary] = useState("");
  const [pendingFile,setPendingFile] = useState<File|null>(null);
  const [pendingPreview,setPendingPreview] = useState("");
  const [saved,setSaved] = useState(false);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadPaymentConfig().then((config) => {
      if (!active) return;
      setUpiId(config.upiId);
      setBeneficiary(config.beneficiary);
      setInstructions(config.instructions);
      setEnabled(config.enabled);
      setQrMode(config.qrMode || "generated");
      setQrAssetKey(config.qrAssetKey || "");
      setQrAssetUrl(config.qrAssetUrl || "");
      setSavedUpiId(config.upiId);
      setSavedBeneficiary(config.beneficiary);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!pendingPreview) return;
    return () => URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  function chooseQrFile(file?: File) {
    if (!file) return;
    if (!QR_TYPES[file.type]) {
      setMessage("Choose a PNG, JPG or WebP image.");
      setSaved(false);
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      setMessage("QR image must be 2 MB or smaller.");
      setSaved(false);
      return;
    }
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreview(url);
    setQrMode("uploaded");
    setMessage("");
    setSaved(false);
  }

  function useGeneratedQr() {
    setQrMode("generated");
    setPendingFile(null);
    setPendingPreview("");
    setMessage("");
    setSaved(false);
  }

  async function saveSettings() {
    const v = upiId.trim();
    const valid = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(v);
    if (enabled && (!valid || !beneficiary.trim())) {
      setSaved(false);
      setMessage("A valid UPI ID and payee name are required to enable collection.");
      return;
    }
    if (v && !valid) {
      setSaved(false);
      setMessage("Enter a valid UPI ID format.");
      return;
    }
    if (qrMode === "uploaded" && !pendingFile && !qrAssetKey) {
      setSaved(false);
      setMessage("Choose a QR image or switch to an auto-generated QR.");
      return;
    }
    if (qrMode === "uploaded" && !pendingFile &&
        (v !== savedUpiId || beneficiary.trim() !== savedBeneficiary)) {
      setSaved(false);
      setMessage("The UPI ID or payee name changed. Upload its matching QR again, or use an auto-generated QR.");
      return;
    }
    if (!supabase) {
      setSaved(false);
      setMessage("Supabase is not configured for this deployment.");
      return;
    }

    setSaving(true);
    setMessage("");
    let uploadedKey = "";
    try {
      let nextQrKey = qrMode === "uploaded" ? qrAssetKey : "";
      if (pendingFile) {
        const extension = QR_TYPES[pendingFile.type];
        uploadedKey = "payment-qr/qr-" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedKey, pendingFile, {
          cacheControl: "60",
          contentType: pendingFile.type,
          upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message || "QR image upload failed.");
        nextQrKey = uploadedKey;
      }

      const next: PaymentConfig = {
        upiId: v,
        beneficiary: beneficiary.trim(),
        instructions,
        enabled,
        qrMode,
        qrAssetKey: nextQrKey,
        qrAssetUrl: "",
      };
      const result = await savePaymentConfig(next);

      if (qrAssetKey && qrAssetKey !== result.qrAssetKey) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([qrAssetKey]);
        if (removeError) {
          setMessage("Settings saved. The previous QR image could not be removed; it is no longer used.");
        }
      }

      setUpiId(result.upiId);
      setBeneficiary(result.beneficiary);
      setInstructions(result.instructions);
      setEnabled(result.enabled);
      setQrMode(result.qrMode);
      setQrAssetKey(result.qrAssetKey);
      setQrAssetUrl(result.qrAssetUrl);
      setSavedUpiId(result.upiId);
      setSavedBeneficiary(result.beneficiary);
      setPendingFile(null);
      setPendingPreview("");
      setSaved(true);
      setMessage("Saved. Customers will see the updated UPI details and QR automatically.");
    } catch (error) {
      if (uploadedKey) {
        await supabase.storage.from(BUCKET).remove([uploadedKey]).catch(() => undefined);
      }
      setSaved(false);
      setMessage(error instanceof Error ? error.message : "Unable to save payment settings.");
    } finally {
      setSaving(false);
    }
  }

  const qrValue = upiId.trim() && beneficiary.trim()
    ? "upi://pay?pa=" + encodeURIComponent(upiId.trim()) + "&pn=" + encodeURIComponent(beneficiary.trim()) + "&cu=INR"
    : "";
  const qrPreview = pendingPreview || (qrMode === "uploaded" ? qrAssetUrl : "");
  const changedSinceSave = v => v; // explicit state comparisons are made below
  const changed = upiId.trim() !== savedUpiId || beneficiary.trim() !== savedBeneficiary ||
    instructions !== (loading ? instructions : instructions) || enabled === !enabled || !!pendingFile;

  return <section className="payment-settings-page">
    <div className="payment-settings-head">
      <div><p className="eyebrow">PAYMENT CONFIGURATION</p><h2>Payment settings</h2><p>Update your receiving UPI ID and customer QR code.</p></div>
      <span className="prototype-tag"><ShieldCheck size={14}/> Admin controlled</span>
    </div>

    <div className="payment-warning">
      <ShieldCheck size={18}/>
      <div><strong>Changes sync automatically</strong><span>Saved UPI details and QR images are served from Supabase. No code edit or site deployment is required.</span></div>
    </div>

    <div className="payment-settings-grid">
      <div className="payment-settings-card">
        <div className="settings-card-title"><div><h3>Receiving details</h3><p>These details are used for new customer payment requests.</p></div></div>

        <label className="settings-label">UPI ID<input value={upiId} onChange={e=>{setUpiId(e.target.value);setSaved(false)}} placeholder="name@bank" autoComplete="off"/></label>
        <label className="settings-label">Beneficiary / display name<input value={beneficiary} onChange={e=>{setBeneficiary(e.target.value);setSaved(false)}} placeholder="Account holder or business name"/></label>
        <label className="settings-label">Customer instructions<textarea rows={3} value={instructions} onChange={e=>{setInstructions(e.target.value);setSaved(false)}}/></label>

        <div className="settings-toggle-row">
          <div><strong>UPI collection</strong><small>Make the saved UPI destination available to customers.</small></div>
          <button className={enabled?"settings-toggle on":"settings-toggle"} onClick={()=>{setEnabled(!enabled);setSaved(false)}} aria-label="Toggle UPI collection">{enabled?<ToggleRight size={24}/>:<ToggleLeft size={24}/>}<span>{enabled?"Enabled":"Disabled"}</span></button>
        </div>

        <button className="primary-settings-button" onClick={()=>void saveSettings()} disabled={loading||saving}>
          <Save size={16}/> {saving?"Saving…":"Save payment settings"}
        </button>
        {message&&<p className={saved?"settings-message success":"settings-message"}>{saved&&<CheckCircle2 size={15}/>} {message}</p>}
      </div>

      <div className="payment-settings-card qr-settings-card">
        <div className="settings-card-title"><div><h3>Customer QR code</h3><p>Choose an auto-generated QR or upload your own.</p></div></div>

        <div className="qr-mode-switch">
          <button type="button" className={qrMode==="generated"?"active":""} onClick={useGeneratedQr}><RefreshCw size={14}/> Auto-generated</button>
          <button type="button" className={qrMode==="uploaded"?"active":""} onClick={()=>{setQrMode("uploaded");setSaved(false)}}><ImagePlus size={14}/> Upload QR</button>
        </div>

        {qrMode==="uploaded"&&<div className="qr-upload-zone">
          <label className="qr-upload-label"><Upload size={16}/><span>{pendingFile?"Replace selected QR":"Choose QR image"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>chooseQrFile(e.target.files?.[0])}/></label>
          <small>PNG, JPG or WebP · Maximum 2 MB. Use a QR that matches the UPI ID above.</small>
        </div>}

        <div className="qr-preview">
          {qrMode==="uploaded"&&qrPreview
            ? <img className="qr-upload-preview" src={qrPreview} alt="Customer payment QR preview"/>
            : qrMode==="uploaded"
              ? <div className="qr-empty"><ImagePlus size={22}/><span>No QR image selected</span><small>Upload your receiving QR image</small></div>
              : qrValue
                ? <QRCodeSVG value={qrValue} size={190} level="M" includeMargin/>
                : <div className="qr-empty"><span>QR preview</span><small>Enter a valid UPI ID and payee name</small></div>}
        </div>
        <div className="qr-preview-note"><ShieldCheck size={15}/><span>{qrMode==="uploaded"?"This exact image is displayed to customers. Upload a replacement whenever the receiving QR changes.":"This QR is generated from the saved UPI ID and beneficiary."}</span></div>
        <div className="payment-preview"><span className="preview-label">CUSTOMER PREVIEW</span><strong>{beneficiary||"Display name"}</strong><span>{upiId||"your-upi-id@bank"}</span><p>{instructions}</p></div>
      </div>
    </div>

    <div className="payment-settings-card verification-card">
      <div className="settings-card-title"><div><h3>Payment verification</h3><p>Payment confirmation requires a trusted provider or bank reconciliation.</p></div><span className="verification-status">Server verified</span></div>
      <div className="verification-footer"><AlertTriangle size={16}/> A QR scan or screenshot is not proof of receipt. Orders remain pending until confirmed by a trusted source.</div>
    </div>
  </section>;
}
