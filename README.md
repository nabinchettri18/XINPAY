# XinPay

XinPay is being developed as a secure payment-operations dashboard foundation.

## Current status

**Prototype only.** This initial commit contains a responsive UI shell and illustrative sample data. It does not process payments, store customer financial data, initiate settlements, or change bank/payment destinations.

## Stack

- React + TypeScript
- Vite
- Cloudflare Pages for the static frontend
- Cloudflare Workers for API services (planned)
- Cloudflare D1 for relational storage (planned)

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


## Payment settings prototype

The Admin sidebar now includes **Payment Settings**. This UI is prototype-only:
- Edit a UPI ID and beneficiary display name
- Edit customer instructions
- Toggle the payment-details display
- Upload a QR image for local preview
- Preview the customer-facing details
- See the planned verification stages

Settings are kept in component state for the current browser session. They are not persisted to a backend and do not publish a receiving destination. Payment verification is not connected.

See [docs/payment-system.md](docs/payment-system.md) and [database/schema.sql](database/schema.sql) for the architecture and draft schema. Do not enable live payment state until a trusted, authorized payment confirmation source and backend security controls are implemented.
