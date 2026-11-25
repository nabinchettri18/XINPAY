import { context, fail, json, method, rateLimit } from "../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "customer-orders", 60))) {
      return fail(res, 429, "Too many requests. Try again shortly.");
    }

    // Keep the query scoped to the authenticated user even when RLS is enabled.
    const { data, error } = await auth.db
      .from("payment_orders")
      .select("id,purpose,amount_minor,currency,status,provider,created_at,updated_at,expires_at")
      .eq("customer_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const orders = (data || []).map((order) => ({
      id: order.id,
      purpose: order.purpose,
      amount: Number(order.amount_minor || 0) / 100,
      currency: order.currency || "INR",
      status: order.status,
      provider: order.provider,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      expiresAt: order.expires_at,
    }));

    return json(res, 200, { orders });
  } catch (error) {
    return fail(res, 503, error.message || "Could not load your payment activity.");
  }
}
