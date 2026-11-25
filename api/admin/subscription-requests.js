import { context, fail, json, method, rateLimit } from "../../server/xinpay-api.js";

const PROOF_BUCKET = "xinpay-subscription-proofs";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  const auth = await context(req, { admin: true });
  if (auth.error) return fail(res, auth.error.status, auth.error.message);

  try {
    if (!(await rateLimit(req, auth.db, "admin-subscriptions", 60))) {
      return fail(res, 429, "Too many requests. Try again shortly.");
    }

    const { data, error } = await auth.db.from("subscription_payment_requests")
      .select("id,customer_id,customer_email,plan_key,plan_name,amount_minor,currency,status,receiver_upi_id,receiver_beneficiary,utr,proof_path,submitted_at,admin_note,created_at,reviewed_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;

    const requests = await Promise.all((data || []).map(async row => {
      let proofUrl = "";
      if (row.proof_path) {
        const { data: signed, error: signedError } = await auth.db.storage
          .from(PROOF_BUCKET).createSignedUrl(row.proof_path, 600);
        if (!signedError) proofUrl = signed?.signedUrl || "";
      }
      return {
        id: row.id,
        customerId: row.customer_id,
        customerEmail: row.customer_email,
        planKey: row.plan_key,
        planName: row.plan_name,
        amountMinor: Number(row.amount_minor),
        currency: row.currency,
        status: row.status,
        receiverUpiId: row.receiver_upi_id,
        receiverBeneficiary: row.receiver_beneficiary,
        utr: row.utr,
        proofUrl,
        submittedAt: row.submitted_at,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
      };
    }));

    return json(res, 200, { requests });
  } catch (error) {
    return fail(res, 503, error.message || "Subscription review queue is unavailable.");
  }
}
