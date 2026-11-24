# XinPay Security Review

## High-priority findings / controls
- Demo metrics, sample transactions, demo customer profile, and wallet balances are not real financial data. They must remain clearly labelled or be removed before public production use.
- Static admin dashboard must be gated by Cloudflare Access or an equivalent identity provider. The API must independently validate the Access JWT (issuer, signature, audience, expiry, and allowlisted identity).
- Do not expose admin API tokens in browser input fields, local storage, session storage, source code, or screenshots.
- Gateway keys must be Worker secrets only.
- Payment status is server-authoritative; never trust query parameters, frontend state, screenshots, or user-submitted references.
- Webhooks must verify signature and timestamp, reject replay, enforce idempotency, verify amount/currency/order mapping, and log a payload hash rather than unnecessary sensitive payload.
- Use integer paise for monetary values. Never use floating-point arithmetic for ledger amounts.
- Orders need expiry and explicit state transitions. Paid is terminal except a separate refund/adjustment ledger event.
- Admin and public endpoints require rate limiting, request-size limits, strict validation, CORS allowlist, and no-store responses.
- Avoid collecting or storing sensitive card data, UPI PINs, OTPs, banking passwords, or authentication credentials.

## Remaining external controls
Cloudflare Access policy, MFA, hostname/DNS, provider onboarding, production API keys, webhook configuration, legal/compliance review, and independent penetration testing cannot be completed solely through repository changes.
