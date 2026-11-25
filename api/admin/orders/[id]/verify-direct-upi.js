import { context, fail, json, method, rateLimit, randomId, sha256, amountIsValid, minor } from "../../../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  const auth = await context(req, { admin: true });
  if (auth.error) return fail(res, auth.error.status, auth.error.message);
  try {
    if (!(await rateLimit(req, auth.db, "admin-verify", 15))) return fail(res, 429, "Rate limit exceeded.");
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const body = req.body && typeof req.body === "object" ? req.body : null;
    const reference = typeof body?.bankReference === "string" ? body.bankReference.trim() : "";
    const bankTime = typeof body?.bankTime === "string" ? body.bankTime.trim() : "";
    const verifiedAmount = body?.verifiedAmount;
    if (!body?.confirmBankCredit || reference.length < 6 || reference.length > 100 ||
        !/^\d{4,100}$/.test(reference.replace(/[^\d]/g, "")) ||
        !bankTime || !Number.isFinite(Date.parse(bankTime)) || !amountIsValid(verifiedAmount)) {
      return fail(res, 400, "Provide the bank reference, transaction time, exact credited amount, and explicit bank-credit confirmation.");
    }
    const { data, error } = await auth.db.rpc("admin_verify_direct_upi", {
      p_order_id: String(id || ""),
      p_reference: reference,
      p_verified_amount_minor: minor(verifiedAmount),
      p_bank_time: new Date(bankTime).toISOString(),
      p_actor: auth.user.email,
      p_event_id: randomId("evt_"),
      p_payload_hash: await sha256(JSON.stringify({ id, reference, verifiedAmount, bankTime, actor: auth.user.email })),
      p_audit_id: randomId("audit_"),
      p_ledger_id: randomId("ledger_"),
    });
    if (error) {
      const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 409;
      return fail(res, status, error.message || "Manual reconciliation failed.");
    }
    return json(res, 200, { ...data, warning: "This records an administrator's manual bank reconciliation; it is not an automated bank/provider confirmation." });
  } catch (error) {
    return fail(res, 503, error.message || "Reconciliation service is unavailable.");
  }
}
