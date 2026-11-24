import { useState } from "react";\nimport { QRCodeSVG } from "qrcode.react";\nimport { getPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import "./payment-settings.css";
import { AlertTriangle, Save, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

export default function PaymentSettings() {
  const [upiId, setUpiId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [instructions, setInstructions] = useState("Use the payment details shown here and keep your transaction reference for your records.");
  const [enabled, setEnabled] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrFileName, setQrFileName] = useState("");
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  function saveDemo() {
    const normalizedUpi = upiId.trim();
    const valid = /^[a-zA-Z0-9.\\-_]{2,256}@[a-zA-Z]{2,64}$/.test(normalizedUpi);
    if (enabled && (!valid || !beneficiary.trim())) {
      setSaved(false);
      setMessage("To enable collection display, enter a valid UPI ID and payee name.");
      return;
    }
    const next: PaymentConfig = { upiId: normalizedUpi, beneficiary: beneficiary.trim(), instructions, enabled };
    savePaymentConfig(next);
    setSaved(true);
    setMessage("Settings saved in this browser. The customer portal will update immediately on this same browser.");
  }
