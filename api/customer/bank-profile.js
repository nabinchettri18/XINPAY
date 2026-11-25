import { context, fail, json, method, rateLimit } from "../../server/xinpay-api.js";

const QR_BUCKET = "xinpay-customer-bank-qr";

export default async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PUT");
    return fail(res, 405, "Method not allowed.");
  }
  if (!method(req, res, req.method)) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "customer-bank-profile", 20))) {
      return fail(res, 429, "Too many profile requests. Try again shortly.");
    }

    if (req.method === "GET") {
      const { data, error } = await auth.db.from("customer_bank_profiles")
        .select("bank_name,account_holder_name,account_last4,ifsc_code,upi_id,qr_asset_key,updated_at")
        .eq("customer_id", auth.user.id).maybeSingle();
      if (error) throw error;
      let qrUrl = "";
      if (data?.qr_asset_key) {
        const { data: signed, error: signedError } = await auth.db.storage
          .from(QR_BUCKET).createSignedUrl(data.qr_asset_key, 600);
        if (!signedError) qrUrl = signed?.signedUrl || "";
      }
      return json(res, 200, {
        profile: data ? {
          bankName: data.bank_name,
          accountHolderName: data.account_holder_name,
          accountLast4: data.account_last4,
          ifscCode: data.ifsc_code,
          upiId: data.upi_id,
          qrAssetKey: data.qr_asset_key,
          qrUrl,
          updatedAt: data.updated_at,
        } : null,
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : null;
    const accountHolderName = String(body?.accountHolderName || "").trim();
    const bankName = String(body?.bankName || "").trim();
    const ifscCode = String(body?.ifscCode || "").trim().toUpperCase();
    const accountLast4 = String(body?.accountLast4 || "").trim();
    const upiId = String(body?.upiId || "").trim();
    const qrAssetKey = String(body?.qrAssetKey || "").trim();

    if (accountHolderName.length < 2 || accountHolderName.length > 100 ||
        bankName.length < 2 || bankName.length > 100 ||
        !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode) ||
        !/^\d{4}$/.test(accountLast4) ||
        !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(upiId)) {
      return fail(res, 400, "Check the account holder, bank, IFSC, last four account digits and UPI ID.");
    }
    if (qrAssetKey && !qrAssetKey.startsWith(auth.user.id + "/profile/qr-")) {
      return fail(res, 400, "The QR image must belong to this customer account.");
    }
    if (qrAssetKey && !/\.(png|jpe?g|webp)$/i.test(qrAssetKey)) {
      return fail(res, 400, "Choose a PNG, JPG or WebP UPI QR image.");
    }

    const { data, error } = await auth.db.rpc("save_customer_bank_profile", {
      p_account_holder_name: accountHolderName,
      p_bank_name: bankName,
      p_ifsc_code: ifscCode,
      p_account_last4: accountLast4,
      p_upi_id: upiId,
      p_qr_asset_key: qrAssetKey || null,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : 400;
      return fail(res, status, error.message || "Could not save bank details.");
    }
    return json(res, 200, { profile: data });
  } catch (error) {
    return fail(res, 503, error.message || "Bank profile service is unavailable.");
  }
}
