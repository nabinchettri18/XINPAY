import { context, fail, json, method, rateLimit, randomId, storagePublicUrl } from "../server/xinpay-api.js";

const PLANS = new Set(["starter", "business", "premium"]);

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  const auth = await context(req);
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "subscription-create", 6))) {
      return fail(res, 429, "Too many plan requests. Try again shortly.");
    }
    const body = req.body && typeof req.body === "object" ? req.body : null;
    const planKey = String(body?.planKey || "");
    if (!PLANS.has(planKey)) return fail(res, 400, "Choose a valid XinPay plan.");

    const requestId = randomId("sub_").slice(0, 28);
    const { data, error } = await auth.db.rpc("create_subscription_payment_request", {
      p_request_id: requestId,
      p_plan_key: planKey,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "55000" ? 503 : 409;
      return fail(res, status, error.message || "Could not create the subscription request.");
    }

    const request = typeof data === "string" ? JSON.parse(data) : data;
    const upiId = request.receiver_upi_id;
    const beneficiary = request.receiver_beneficiary;
    const amount = Number(request.amount_minor) / 100;
    const upiUri = "upi://pay?pa=" + encodeURIComponent(upiId) +
      "&pn=" + encodeURIComponent(beneficiary) +
      "&am=" + encodeURIComponent(amount.toFixed(2)) +
      "&cu=INR&tn=" + encodeURIComponent("XinPay " + request.id);

    return json(res, 201, {
      request: {
        id: request.id,
        planKey: request.plan_key,
        planName: request.plan_name,
        amountMinor: Number(request.amount_minor),
        amount,
        status: request.status,
        createdAt: request.created_at,
      },
      payment: {
        upiId,
        beneficiary,
        qrMode: request.receiver_qr_mode,
        qrAssetUrl: request.receiver_qr_asset_key
          ? storagePublicUrl("xinpay-payment-qr", request.receiver_qr_asset_key) + "?v=" + Number(request.receiver_config_version || 0)
          : "",
        upiUri,
        instructions: "Pay the exact amount to the verified recipient shown. Keep the UTR and payment confirmation screenshot.",
      },
    });
  } catch (error) {
    return fail(res, 503, error.message || "Subscription service is unavailable.");
  }
}
