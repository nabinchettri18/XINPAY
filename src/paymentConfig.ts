export type PaymentConfig = { upiId: string; beneficiary: string; instructions: string; enabled: boolean };
const KEY = "xinpay.payment-config";
const DEFAULTS: PaymentConfig = { upiId: "", beneficiary: "", instructions: "Use the payment details shown here and keep your transaction reference for your records.", enabled: false };
export function getPaymentConfig(): PaymentConfig {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS; } catch { return DEFAULTS; }
}
export function savePaymentConfig(config: PaymentConfig) {
  localStorage.setItem(KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("xinpay-payment-config-updated"));
}
export function subscribePaymentConfig(callback: () => void) {
  window.addEventListener("xinpay-payment-config-updated", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("xinpay-payment-config-updated", callback); window.removeEventListener("storage", callback); };
}
