import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import { QRCodeSVG } from "qrcode.react";
import { getPaymentConfig, savePaymentConfig, type PaymentConfig } from "./paymentConfig";
import "./payment-settings.css";
import { AlertTriangle, Save, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

export default function PaymentSettings() {
  const initial = getPaymentConfig();
  const [upiId, setUpiId] = useState(initial.upiId);
  const [beneficiary, setBeneficiary] = useState(initial.beneficiary);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [enabled, setEnabled] = useState(initial.enabled);
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
  }  function saveDemo() {
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
