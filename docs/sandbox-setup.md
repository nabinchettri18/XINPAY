# Sandbox configuration checklist

This feature branch intentionally keeps payment processing disabled by default. Direct UPI can be enabled separately for manual-reconciliation testing.

## Worker variables (Cloudflare)
Set the following only after creating a Cloudflare Access application for the admin interface:
- `CF_ACCESS_TEAM_DOMAIN`: your Cloudflare Access team domain (without protocol)
- `CF_ACCESS_AUD`: Access application audience tag
- `ADMIN_EMAILS`: comma-separated exact admin email addresses
- `CASHFREE_ENV`: `sandbox`
- `PAYMENTS_ENABLED`: leave `false` until sandbox credentials and webhook verification have been tested\n- `DIRECT_UPI_ENABLED`: leave `false`; only enable after manual-reconciliation UI/API tests and an approved receiving account are ready
- `PUBLIC_BASE_URL`: public XinPay origin

## Worker secrets
Add these as encrypted Worker secrets, never as frontend `VITE_*` variables:
- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`
- `CASHFREE_WEBHOOK_SECRET`

## Access configuration
1. Use a dedicated admin hostname if possible and create a Cloudflare Access self-hosted application.
2. Restrict to administrator email identities; require MFA.
3. Configure the app audience tag and team domain.
4. Protect the admin dashboard and API path. The Worker independently validates the Access JWT, audience, issuer, signature, expiration, and email allowlist.
5. Test with a non-admin account and unauthenticated requests. Both must receive 401.

## Cashfree sandbox
1. Obtain sandbox credentials from the Cashfree merchant dashboard.
2. Register `https://<your-host>/api/webhooks/cashfree` as the webhook endpoint and configure the webhook signing secret.
3. Verify a successful sandbox payment, failure, pending, amount mismatch, duplicate event, stale timestamp, forged signature, and webhook replay.
4. Confirm only a valid success event creates one ledger posting and changes order status to paid.

## Feature flag
Only enable `PAYMENTS_ENABLED=true` for sandbox after the above checks. Production mode is hard-blocked in this implementation. Do not enable real money payments until merchant approval, compliance, legal terms, reconciliation and independent security review are completed.
\n## Direct UPI manual reconciliation (experimental)\n\nDirect UPI orders use a dynamic QR/UPI Intent and remain `pending`. They do not use the unofficial Paytm Business status endpoint or scrape SMS/email. The admin reconciliation action requires Cloudflare Access and records the bank reference, exact credited amount, transaction timestamp, administrator identity, an audit record, and one ledger posting. The admin must independently inspect the actual bank/UPI account; customer screenshots or submitted references alone are not evidence.\n\nEnable only with Worker variable `DIRECT_UPI_ENABLED=true` after tests. Production payments remain disabled and must not be represented as automatically verified. The manual process is an administrator attestation, not a bank API integration.\n