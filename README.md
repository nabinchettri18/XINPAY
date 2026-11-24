# XinPay

XinPay is being developed as a secure payment-operations dashboard foundation.

## Current status

**Prototype only — not production payment software.** The interface contains sample data and a limited UPI display-configuration API. It does not process or verify payments, maintain a real wallet/ledger, initiate settlements, or change bank/payment destinations. Do not use it to collect or represent real money as paid.

## Stack

- React + TypeScript
- Vite
- Cloudflare Pages for the static frontend
- Cloudflare Workers for the UPI configuration API (prototype implementation added)
- Cloudflare D1 for UPI configuration and audit records (migration added; deployment required)

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
- Payment status must be confirmed server-side using provider-verified webhooks and reconciliation.
- Settlement destinations must be provider-approved and independently verified.
- Admin operations require authentication, authorization, re-authentication for sensitive actions, and audit logging.
- This UI is not a substitute for provider, legal, compliance, or security review.


## Admin-controlled UPI settings

The Payment Settings admin module now uses the Cloudflare Worker API and D1 (once deployed) rather than browser localStorage:
- Edit receiving UPI ID, beneficiary name, and instructions.
- Enable/disable the customer-facing UPI collection display.
- Generate QR preview dynamically.
- Admin API writes require a Worker secret token.
- Customer portal fetches the same public config across devices.

**Still prototype-only:** payment receipt verification, ledger, and payment provider integration are not connected. A QR scan or screenshot is not proof of receipt.

Deployment instructions: [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md). See also [docs/payment-system.md](docs/payment-system.md), [database/schema.sql](database/schema.sql), and [database/migrations/0001_payment_config.sql](database/migrations/0001_payment_config.sql).
