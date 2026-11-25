import { context, fail, json, method, publicConfig, randomId } from "../server/xinpay-api.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!method(req, res, "GET")) return;
    try { return json(res, 200, await publicConfig()); }
    catch { return fail(res, 503, "Payment configuration is unavailable."); }
  }
  if (req.method === "PUT") {
    if (!method(req, res, "PUT")) return;
    const auth = await context(req, { admin: true });
    if (auth.error) return fail(res, auth.error.status, auth.error.message);
    const body = req.body && typeof req.body === "object" ? req.body : null;
    if (!body || typeof body.enabled !== "boolean" ||
        typeof body.upiId !== "string" || typeof body.beneficiary !== "string" ||
        typeof body.instructions !== "string") return fail(res, 400, "Invalid payment configuration.");
    const upiId = body.upiId.trim();
    const beneficiary = body.beneficiary.trim().slice(0, 200);
    const instructions = body.instructions.trim().slice(0, 1000);
    const validUpi = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId);
    if (body.enabled && (!validUpi || !beneficiary)) return fail(res, 400, "A valid UPI ID and beneficiary are required before enabling collection.");
    if (upiId && !validUpi) return fail(res, 400, "Enter a valid UPI ID format.");
    const { data, error } = await auth.db.rpc("admin_update_payment_config", {
      p_upi_id: upiId,
      p_beneficiary: beneficiary,
      p_instructions: instructions,
      p_enabled: body.enabled,
      p_actor: auth.user.email,
      p_audit_id: randomId("audit_"),
    });
    if (error) return fail(res, 409, error.message || "Could not save payment configuration.");
    return json(res, 200, {
      upiId: data?.receiving_upi_id || "",
      beneficiary: data?.beneficiary_display_name || "",
      instructions: data?.instructions || "",
      enabled: !!data?.enabled,
      version: Number(data?.version || 0),
      updatedAt: data?.updated_at || "",
    });
  }
  res.setHeader("Allow", "GET, PUT");
  return fail(res, 405, "Method not allowed.");
}
