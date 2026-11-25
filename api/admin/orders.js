import { context, fail, json, method, rateLimit } from "../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  const auth = await context(req, { admin: true });
  if (auth.error) return fail(res, auth.error.status, auth.error.message);
  try {
    if (!(await rateLimit(req, auth.db, "admin-orders", 60))) return fail(res, 429, "Rate limit exceeded.");
    const { data, error } = await auth.db.from("payment_orders")
      .select("id,customer_id,provider,provider_order_id,purpose,amount_minor,currency,status,provider_status,expires_at,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return json(res, 200, { orders: data || [], admin: auth.user.email });
  } catch (error) {
    return fail(res, 503, error.message || "Could not load payment orders.");
  }
}
