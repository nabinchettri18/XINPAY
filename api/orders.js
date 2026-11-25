import { context, fail, json, method, rateLimit, amountIsValid, minor, randomId, randomToken, sha256, cashfreeBase, cashfreeHeaders, environment, paymentsEnabled } from "../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);
  if (!paymentsEnabled()) return fail(res, 503, "Payment checkout is disabled. Sandbox credentials and an explicit feature flag are required.");
  if (environment("CASHFREE_ENV") === "production") return fail(res, 403, "Production payments are blocked in this build.");
  if (!environment("CASHFREE_CLIENT_ID") || !environment("CASHFREE_CLIENT_SECRET")) return fail(res, 503, "Cashfree sandbox credentials are not configured.");
  try {
    if (!(await rateLimit(req, auth.db, "orders", 10))) return fail(res, 429, "Rate limit exceeded.");
    const body = req.body && typeof req.body === "object" ? req.body : null;
    if (!body || !amountIsValid(body.amount) || typeof body.purpose !== "string" ||
        !body.purpose.trim() || body.purpose.length > 100) return fail(res, 400, "Amount must be ₹1–₹10,00,000 and purpose is required.");

    const orderId = randomId("xp_").slice(0, 31);
    const orderToken = randomToken();
    const baseUrl = (environment("PUBLIC_BASE_URL") || (environment("VERCEL_URL") ? "https://" + environment("VERCEL_URL") : "https://xinpay65.vercel.app")).replace(/\/$/, "");
    const payload = {
      order_id: orderId, order_amount: body.amount, order_currency: "INR",
      customer_details: {
        customer_id: "cust_" + auth.user.id.replace(/-/g, "").slice(0, 24),
        customer_name: String(auth.user.user_metadata?.full_name || "Customer").slice(0, 100),
        customer_email: String(auth.user.email || "").slice(0, 120),
        customer_phone: String(body.phone || "").replace(/[^0-9]/g, "").slice(-10) || "9999999999",
      },
      order_meta: { return_url: baseUrl + "/customer?order_id=" + encodeURIComponent(orderId) },
    };
    const providerResponse = await fetch(cashfreeBase() + "/orders", {
      method: "POST", headers: cashfreeHeaders(), body: JSON.stringify(payload),
    });
    const providerData = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) return fail(res, 502, "Payment provider rejected the order.", { detail: providerData.message || providerData.type || "Provider error" });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await auth.db.from("payment_orders").insert({
      id: orderId, provider: "cashfree", provider_order_id: providerData.order_id || orderId,
      customer_id: auth.user.id, customer_email: auth.user.email,
      purpose: body.purpose.trim().slice(0, 100), amount_minor: minor(body.amount),
      currency: "INR", status: "pending", payment_session_id: providerData.payment_session_id || null,
      payment_link: providerData.payment_link || null, customer_access_hash: await sha256(orderToken),
      expires_at: expiresAt,
    });
    if (error) throw error;
    return json(res, 201, { orderId, orderToken, status: "pending", amount: body.amount, currency: "INR", checkoutUrl: providerData.payment_link || null, paymentSessionId: providerData.payment_session_id || null, expiresAt });
  } catch (error) {
    return fail(res, 503, error.message || "Could not create a payment order.");
  }
}
