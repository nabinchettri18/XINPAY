# XinPay

XinPay is being developed as a secure payment-operations dashboard foundation.

## Current status

**Prototype only — not production payment software.** The interface contains sample data and a limited UPI display-configuration API. Cashfree sandbox order flow and an experimental Direct UPI QR/manual bank-reconciliation path are under development. Direct UPI stays pending until an Access-protected administrator independently matches the bank credit. It is not automated bank verification and is not production payment software. Do not use it to collect or represent real money as paid.

## Stack

- React + TypeScript
- Vite
- Vercel for the React + Vite customer/admin frontend
- Supabase Auth for customer registration, email verification, sessions and password reset
- Supabase PostgreSQL for future customer/profile data with RLS
- Existing Cloudflare Worker + D1 remain the experimental payment/configuration API during the Vercel migration; customer authentication does not use Worker/D1

## Local development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Vercel frontend build settings

For the Vercel project connected to this repository:

- Framework preset: **Vite**
- Build command: **npm run build**
- Output directory: **dist**
- Root directory: **/**
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the Vercel environment variables for Preview and Production.

See [Vercel + Supabase Auth configuration](docs/cloudflare-deployment.md#customer-sign-in-and-account-creation-vercel--supabase-auth) for email confirmation, redirect URLs, and SMTP setup.

## Legacy Cloudflare Worker API deployment

The payment/configuration Worker is still a separate experimental API and has not yet been migrated to Vercel. Its deployment instructions are in [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md).

<!-- Legacy Cloudflare Pages build settings retained for historical setup reference -->
## Cloudflare Pages build settings

For a Pages project connected to this repository:

- Framework preset: **Vite**
- Build command: **npm run build**
- Build output directory: **dist**
- Root directory: **/**

## Planned modules

- Dashboard overview
- Transactions and reconciliation
- Settlement batches and approved settlement-account workflows
- Customer records
- Support queue
- Settings and role-based access
- Immutable audit trail

## Security principles

- No secrets in frontend code or `VITE_*` variables.
- Payment status must be confirmed server-side using provider-verified webhooks or clearly audited manual reconciliation; admin attestation must not be presented as automated provider verification.
- Settlement destinations must be provider-approved and independently verified.
- Admin operations require authentication, authorization, re-authentication for sensitive actions, and audit logging.
- This UI is not a substitute for provider, legal, compliance, or security review.


## Customer authentication

Customer registration, email confirmation, login and password recovery are handled by Supabase Auth from the Vercel-hosted frontend. The customer portal no longer uses a custom Worker/D1 password or session store. Keep the Supabase publishable key in Vercel environment variables only; never expose secret/service-role keys. See the Vercel + Supabase Auth setup above.

## Admin-controlled UPI settings

The Payment Settings admin module now uses the Cloudflare Worker API and D1 (once deployed) rather than browser localStorage:
- Edit receiving UPI ID, beneficiary name, and instructions.
- Enable/disable the customer-facing UPI collection display.
- Generate QR preview dynamically.
- Admin API writes require a Worker secret token.
- Customer portal fetches the same public config across devices.

**Still prototype-only:** payment receipt verification, ledger, and payment provider integration are not connected. A QR scan or screenshot is not proof of receipt.

Deployment instructions: [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md). See also [docs/payment-system.md](docs/payment-system.md), [database/schema.sql](database/schema.sql), and [database/migrations/0001_payment_config.sql](database/migrations/0001_payment_config.sql).
\n## Direct UPI (experimental)\n\nDirect UPI order creation is independently gated by the Worker variable `DIRECT_UPI_ENABLED` (default off). It creates a dynamic QR/UPI Intent and a pending order. The customer-provided UTR is not accepted as payment proof. An administrator must inspect the actual receiving account, match the credit, exact amount and transaction time, then submit a reconciliation through Cloudflare Access. The operation records a unique payment event, audit record and idempotent ledger posting. This feature is not automated verification and remains disabled until end-to-end tests are complete. See [sandbox setup](docs/sandbox-setup.md).\n