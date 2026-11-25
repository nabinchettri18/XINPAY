import { context, fail, json, method, rateLimit } from "../../../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  const auth = await context(req, { admin: true });
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "admin-subscription-review", 20))) {
      return fail(res, 429, "Too many review actions. Try again shortly.");
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const body = req.body && typeof req.body === "object" ? req.body : null;
    const decision = String(body?.decision || "");
    const note = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) : "";
    const confirmBankCredit = body?.confirmBankCredit === true;

    if (!id || id.length > 80 || !["approve", "reject"].includes(decision)) {
      return fail(res, 400, "Choose approve or reject for this payment request.");
    }
    if (decision === "approve" && !confirmBankCredit) {
      return fail(res, 400, "Confirm that the UTR and exact credit were checked in the receiving bank account.");
    }

    const { data, error } = await auth.db.rpc("admin_review_subscription_payment_request", {
      p_request_id: String(id),
      p_decision: decision,
      p_admin_note: note,
      p_confirm_bank_credit: confirmBankCredit,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409;
      return fail(res, status, error.message || "Could not review this subscription payment.");
    }
    return json(res, 200, data);
  } catch (error) {
    return fail(res, 503, error.message || "Subscription review is unavailable.");
  }
}
