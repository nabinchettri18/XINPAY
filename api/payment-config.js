import { context, fail, json, method, publicConfig, randomId, storagePublicUrl } from "../server/xinpay-api.js";

const QR_KEY_PATTERN = /^payment-qr\/qr-[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/;

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
        typeof body.instructions !== "string" ||
        typeof body.qrMode !== "string" || typeof body.qrAssetKey !== "string") {
      return fail(res, 400, "Invalid payment configuration.");
    }

    const upiId = body.upiId.trim();
    const beneficiary = body.beneficiary.trim().slice(0, 200);
    const instructions = body.instructions.trim().slice(0, 1000);
    const qrMode = body.qrMode;
    const qrAssetKey = body.qrAssetKey.trim();
    const validUpi = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId);
    const qrMode = body.qrMode === "uploaded" ? "uploaded" : "generated";
    const qrAssetKey = typeof body.qrAssetKey === "string" ? body.qrAssetKey.trim() : "";
    if (qrMode === "uploaded" && !/^payment-qr\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/.test(qrAssetKey)) {
      return fail(res, 400, "Upload a valid QR image before saving.");
    }

    if (body.enabled && (!validUpi || !beneficiary)) {
      return fail(res, 400, "A valid UPI ID and beneficiary are required before enabling collection.");
    }
    if (upiId && !validUpi) return fail(res, 400, "Enter a valid UPI ID format.");
    if (!["generated", "uploaded"].includes(qrMode)) return fail(res, 400, "Choose a valid QR mode.");
    if (qrMode === "uploaded" && !QR_KEY_PATTERN.test(qrAssetKey)) {
      return fail(res, 400, "Upload a PNG, JPG or WebP QR image before saving.");
    }

    const { data, error } = await auth.db.rpc("admin_update_payment_config_with_qr", {
      p_upi_id: upiId,
      p_beneficiary: beneficiary,
      p_instructions: instructions,
      p_enabled: body.enabled,
      p_qr_asset_key: qrMode === "uploaded" ? qrAssetKey : null,
      p_qr_mode: qrMode,
      p_actor: auth.user.email,
      p_audit_id: randomId("audit_"),
    });

    if (error) return fail(res, 409, error.message || "Could not save payment configuration.");

    const result = {
      upiId: data?.receiving_upi_id || "",
      beneficiary: data?.beneficiary_display_name || "",
      instructions: data?.instructions || "",
      enabled: !!data?.enabled,
      qrMode: data?.qr_mode || "generated",
      qrAssetKey: data?.qr_asset_key || "",
      qrAssetUrl: "",
      version: Number(data?.version || 0),
      updatedAt: data?.updated_at || "",
    };
    if (result.qrMode === "uploaded" && result.qrAssetKey) {
      result.qrAssetUrl = auth.db.storage.from("xinpay-payment-qr")
        .getPublicUrl(result.qrAssetKey).data.publicUrl + "?v=" + result.version;
    }
    return json(res, 200, result);
  }

  res.setHeader("Allow", "GET, PUT");
  return fail(res, 405, "Method not allowed.");
}
