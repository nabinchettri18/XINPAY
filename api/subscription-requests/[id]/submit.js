import { context, fail, json, method, rateLimit } from "../../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "subscription-submit", 8))) {
      return fail(res, 429, "Too many submissions. Try again shortly.");
    }
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const body = req.body && typeof req.body === "object" ? req.body : null;
    const utr = String(body?.utr || "").trim();
    const proofPath = String(body?.proofPath || "").trim();

    if (!id || id.length > 80 || !/^[A-Za-z0-9-]{8,35}$/.test(utr)) {
      return fail(res, 400, "Enter a valid UTR or transaction reference.");
    }
    const expectedPrefix = auth.user.id + "/" + id + "/proof-";
    if (!proofPath.startsWith(expectedPrefix) || !/\.(png|jpe?g|webp)$/i.test(proofPath)) {
      return fail(res, 400, "The uploaded proof does not match this payment request.");
    }

    const { data, error } = await auth.db.rpc("submit_subscription_payment_proof", {
      p_request_id: String(id),
      p_utr: utr,
      p_proof_path: proofPath,
    });
    if (error) {
      const status = error.code === "23505" ? 409 : error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
      return fail(res, status, error.message || "Could not submit payment proof.");
    }
    return json(res, 200, data);
  } catch (error) {
    return fail(res, 503, error.message || "Payment proof submission is unavailable.");
  }
}
