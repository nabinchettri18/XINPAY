import { context, fail, json, method, rateLimit, storagePublicUrl } from "../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "customer-subscription", 60))) {
      return fail(res, 429, "Too many account requests. Try again shortly.");
    }

    const [membershipResult, requestsResult, profileResult] = await Promise.all([
      auth.db.from("customer_memberships")
        .select("plan_key,plan_name,paid_amount_minor,status,activation_request_id,activated_at")
        .eq("customer_id", auth.user.id).maybeSingle(),
      auth.db.from("subscription_payment_requests")
        .select("id,plan_key,plan_name,amount_minor,currency,status,utr,admin_note,created_at,submitted_at,reviewed_at,receiver_upi_id,receiver_beneficiary,receiver_qr_mode,receiver_qr_asset_key,receiver_config_version")
        .eq("customer_id", auth.user.id)
        .order("created_at", { ascending: false }).limit(50),
      auth.db.from("customer_bank_profiles")
        .select("bank_name,account_holder_name,account_last4,ifsc_code,upi_id,qr_asset_key,updated_at")
        .eq("customer_id", auth.user.id).maybeSingle(),
    ]);

    if (membershipResult.error) throw membershipResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (profileResult.error) throw profileResult.error;

    return json(res, 200, {
      membership: membershipResult.data ? {
        planKey: membershipResult.data.plan_key,
        planName: membershipResult.data.plan_name,
        paidAmountMinor: Number(membershipResult.data.paid_amount_minor),
        status: membershipResult.data.status,
        activationRequestId: membershipResult.data.activation_request_id,
        activatedAt: membershipResult.data.activated_at,
      } : null,
      requests: (requestsResult.data || []).map(row => ({
        id: row.id,
        planKey: row.plan_key,
        planName: row.plan_name,
        amountMinor: Number(row.amount_minor),
        currency: row.currency,
        status: row.status,
        utr: row.utr,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        payment: {
          upiId: row.receiver_upi_id,
          beneficiary: row.receiver_beneficiary,
          qrMode: row.receiver_qr_mode,
          qrAssetUrl: row.receiver_qr_asset_key
            ? storagePublicUrl("xinpay-payment-qr", row.receiver_qr_asset_key) + "?v=" + Number(row.receiver_config_version || 0)
            : "",
          upiUri: "upi://pay?pa=" + encodeURIComponent(row.receiver_upi_id) +
            "&pn=" + encodeURIComponent(row.receiver_beneficiary) +
            "&am=" + encodeURIComponent((Number(row.amount_minor) / 100).toFixed(2)) +
            "&cu=INR&tn=" + encodeURIComponent("XinPay " + row.id),
        },
      })),
      bankProfile: profileResult.data ? {
        bankName: profileResult.data.bank_name,
        accountHolderName: profileResult.data.account_holder_name,
        accountLast4: profileResult.data.account_last4,
        ifscCode: profileResult.data.ifsc_code,
        upiId: profileResult.data.upi_id,
        qrAssetKey: profileResult.data.qr_asset_key,
        updatedAt: profileResult.data.updated_at,
      } : null,
    });
  } catch (error) {
    return fail(res, 503, error.message || "Could not load subscription status.");
  }
}
