import { serviceClient, fail, json, environment, sha256, constantTimeEqual } from "../../server/xinpay-api.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  if (req.rawBody) return Buffer.from(req.rawBody).toString("utf8");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function encodeBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed.");
  }
  const secret = environment("CASHFREE_WEBHOOK_SECRET");
  if (!secret) return fail(res, 503, "Cashfree webhook is not configured.");
  let raw;
  try { raw = await rawBody(req); }
  catch { return fail(res, 400, "Invalid webhook body."); }
  if (Buffer.byteLength(raw, "utf8") > 1024 * 1024) return fail(res, 413, "Payload too large.");
  const timestamp = String(req.headers["x-webhook-timestamp"] || "");
  const signature = String(req.headers["x-webhook-signature"] || "");
  if (!timestamp || !signature || !/^\d{10,16}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return fail(res, 400, "Invalid webhook timestamp.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + raw));
  if (!constantTimeEqual(encodeBase64(signed), signature)) return fail(res, 401, "Invalid webhook signature.");
  let event;
  try { event = JSON.parse(raw); } catch { return fail(res, 400, "Invalid webhook JSON."); }
  const orderId = event?.data?.order?.order_id;
  const payment = event?.data?.payment;
  if (!orderId || !payment) return fail(res, 400, "Missing payment data.");
  const amount = Number(payment.payment_amount);
  const amountMinor = Number.isFinite(amount) ? Math.round(amount * 100) : null;
  const currency = payment.payment_currency || event?.data?.order?.order_currency || "INR";
  try {
    const db = serviceClient();
    const { data, error } = await db.rpc("record_cashfree_webhook", {
      p_order_id: String(orderId),
      p_event_id: crypto.randomUUID(),
      p_provider_event_id: event?.event_id ? String(event.event_id) : null,
      p_reference: payment.cf_payment_id || payment.payment_id ? String(payment.cf_payment_id || payment.payment_id) : null,
      p_event_type: String(event?.type || "unknown"),
      p_amount_minor: amountMinor,
      p_currency: String(currency),
      p_payment_status: String(payment.payment_status || "UNKNOWN"),
      p_payload_hash: await sha256(raw),
    });
    if (error) throw error;
    return json(res, 200, { success: true, result: data });
  } catch (error) {
    return fail(res, 503, error.message || "Webhook could not be persisted.");
  }
}
