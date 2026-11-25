import { context, fail, json, method, rateLimit, amountIsValid, minor, randomId, randomToken, sha256, defaultInstructions, publicConfig, directUpiEnabled } from "../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);
  if (!directUpiEnabled()) return fail(res, 503, "Direct UPI is disabled until payment collection is explicitly configured.");
  try {
    if (!(await rateLimit(req, auth.db, "direct-orders", 8))) return fail(res, 429, "Rate limit exceeded.");
    const body = req.body && typeof req.body === "object" ? req.body : null;
    if (!body || !amountIsValid(body.amount) || typeof body.purpose !== "string" ||
        !body.purpose.trim() || body.purpose.length > 100) return fail(res, 400, "A valid amount and payment purpose are required.");
    const config = await publicConfig();
    if (!config.enabled || !config.upiId || !config.beneficiary) return fail(res, 503, "Direct UPI collection is not configured.");
    const id = randomId("upi_").slice(0, 28);
    const orderToken = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const upiUri = "upi://pay?pa=" + encodeURIComponent(config.upiId) +
      "&pn=" + encodeURIComponent(config.beneficiary) +
      "&am=" + encodeURIComponent(body.amount.toFixed(2)) +
      "&cu=INR&tn=" + encodeURIComponent("XinPay " + id);
    const { error } = await auth.db.from("payment_orders").insert({
      id, provider: "direct_upi", customer_id: auth.user.id,
      customer_email: auth.user.email, purpose: body.purpose.trim().slice(0, 100),
      amount_minor: minor(body.amount), currency: "INR", status: "pending",
      customer_access_hash: await sha256(orderToken),
      destination_config_version: config.version,
      destination_snapshot: { upiId: config.upiId, beneficiary: config.beneficiary },
      expires_at: expiresAt,
    });
    if (error) throw error;
    return json(res, 201, { orderId: id, orderToken, status: "pending", amount: body.amount, currency: "INR", upiUri, upiId: config.upiId, beneficiary: config.beneficiary, expiresAt, verification: "manual", qrMode: config.qrMode, qrUrl: config.qrUrl });
  } catch (error) {
    return fail(res, 503, error.message || "Could not create a direct UPI order.");
  }
}
