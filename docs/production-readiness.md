# XinPay Production Readiness (Phases 2–6)

## Current reality
XinPay is a deployed prototype. The current dashboard and customer portal contain illustrative/sample records. The existing UPI QR/intent flow is **not payment verification** and must not be represented as a real payment product. This repository change prepares data/API foundations but cannot activate a gateway without merchant approval and secrets.

## Phase 2 — Identity and admin protection
- Use Cloudflare Access on a separate admin hostname (recommended: admin.xinpay domain).
- Restrict Access policy to named administrators, require MFA, and configure a session duration.
- Protect admin APIs too; hostname-only/frontend-only protection is insufficient.
- Configure Worker Access JWT verification using Access team domain, application audience, and an allowlisted admin identity.
- Do not use shared tokens typed into a browser or persist secrets client-side.
- Access dashboard setup and DNS/domain ownership are external prerequisites.

## Phase 3 — Provider integration
The intended adapter is Cashfree Payments (INR). It is disabled until merchant onboarding and credentials are complete.
Required secrets/config:
- CASHFREE_CLIENT_ID
- CASHFREE_CLIENT_SECRET
- CASHFREE_ENV (sandbox/production)
- CASHFREE_WEBHOOK_SECRET / webhook verification configuration as specified by Cashfree
- Public callback/return URL
- Provider account approved for the intended business and use case

Do not expose provider secrets through VITE_* variables or static assets. Do not use QR scans, screenshots, UTR claims, or client callbacks as payment proof. Only signed provider webhooks and/or server-side provider status verification may transition orders to paid.

## Phase 4 — Transaction/ledger
Migration 0003 introduces orders, provider events, and immutable ledger-entry foundations. Order amounts are stored as integer minor units (paise). Event payloads must be hashed; provider event IDs and references are idempotency keys. Paid status must be changed only in a transaction after trusted verification. Refunds require a separate verified event/ledger entry.

## Phase 5 — Customer experience
- Use provider-hosted checkout/session URL; never collect UPI PIN, OTP, card PIN, or credentials.
- Show clear pending state and poll only server order status.
- Receipt contains XinPay order ID and provider reference, and is generated only after server verification.
- Customer authentication and PII minimization remain required before any wallet/account functionality.
- Current customer portal is still a UI prototype; its demo balances/transactions must not be used as live financial records.

## Phase 6 — Production gates
- Security review and threat model
- Gateway sandbox tests: success, failure, pending, timeout, duplicate webhook, forged webhook, amount mismatch, wrong currency, expired order, replay, refund
- D1 backup/restore drill and data retention policy
- Monitoring/alerting for API errors, webhook failures, and reconciliation mismatches
- Rate limits on public order creation and webhook routes
- Admin audit log review and access removal procedure
- Terms, privacy policy, customer support, dispute/refund process, and business compliance review
- Production credentials and approved merchant account
- Reconciliation against provider reports/bank settlement statements
- Feature flag must remain off until all gates are signed off

## Deployment status
The CI pipeline can build and deploy repository changes. A production payment feature should not be enabled just because a deployment succeeds. External configuration (Cloudflare Access, gateway credentials, domains, merchant approval, legal/compliance) must be completed by the account owner.
