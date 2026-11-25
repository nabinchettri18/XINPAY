# XinPay Vercel backend

The application API is implemented as Vercel Functions under `api/`. Shared server-only helpers live in `server/xinpay-api.js`. The frontend calls same-origin `/api/*` routes; there is no Cloudflare Worker or D1 runtime in the active deployment.

The XinPay Supabase project contains the PostgreSQL tables, RLS policies, per-user database rate limits and RPC functions used by the Vercel Functions. Admin authorization is checked with a Supabase Auth session and the private admin allowlist. Customer accounts do not become administrators through signup.

## Preview environment

The Vercel Preview environment has `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` configured. The frontend still uses the Vite-prefixed publishable configuration for browser sign-in.

Cashfree and Direct UPI flags remain disabled. Cashfree webhook persistence additionally requires a server-only `SUPABASE_SECRET_KEY`, which is not currently configured. Do not enable payment flags until provider credentials, webhook verification, callback URLs and operational reconciliation have been tested.

## Pending security review

Supabase's security advisor flagged RLS as disabled on `private.admin_allowlist`. The proposed remediation is recorded in `SECURITY_REMEDIATION_PENDING.sql`, but it has deliberately not been applied pending approval. The table is in the private schema and is used only by the server-owned admin-check function; nevertheless the advisor's finding must be cleared before the API is considered production-ready.


## Runtime payment destination management

The admin console's Payment Settings screen updates the single `public.payment_config` row through the audited `admin_update_payment_config_v2` RPC. UPI ID, beneficiary, visibility and QR mode are runtime database settings; changing them does not require a Vercel redeploy.

Uploaded QR images are stored in the public-read `xinpay-payment-assets` Storage bucket. Uploads, listing and deletion are restricted by Storage RLS to accounts that pass `private.is_xinpay_admin()`. The bucket accepts PNG, JPEG and WebP up to 1 MB. Public reads are required so customer checkout can display the QR, but no public upload or listing is allowed.

New Direct UPI requests snapshot the UPI ID, beneficiary and QR asset version used when the order is created, so a later admin change does not silently alter an already-issued payment request.
