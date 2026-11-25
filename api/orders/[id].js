import { context, fail, json, method, sha256, constantTimeEqual } from "../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const orderToken = req.headers["x-order-token"] || "";
  if (typeof orderToken !== "string" || !orderToken) return fail(res, 401, "Order access token is required.");
  const { data, error } = await auth.db.from("payment_orders")
    .select("id,status,amount_minor,currency,purpose,expires_at,created_at,updated_at,customer_access_hash")
    .eq("id", String(id || "")).maybeSingle();
  if (error || !data) return fail(res, 404, "Order not found.");
  if (!constantTimeEqual(await sha256(orderToken), data.customer_access_hash || "")) return fail(res, 401, "Order access token is invalid.");
  const { customer_access_hash, ...safeOrder } = data;
  return json(res, 200, { ...safeOrder, amount: Number(safeOrder.amount_minor) / 100 });
}
