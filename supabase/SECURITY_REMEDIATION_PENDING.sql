-- SECURITY REMEDIATION — NOT YET APPLIED.
-- Supabase's security advisor detected RLS disabled on private.admin_allowlist.
-- Enable RLS without adding client policies so only the existing SECURITY DEFINER
-- function (private.is_xinpay_admin) can read the allowlist.
-- Apply only after reviewing and approving this change:
ALTER TABLE "private"."admin_allowlist" ENABLE ROW LEVEL SECURITY;
