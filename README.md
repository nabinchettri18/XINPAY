# XinPay

XinPay is a payment-operations dashboard foundation.

## Architecture

- **Frontend/deployments:** Vercel (React + TypeScript + Vite)
- **Backend/database:** Existing Supabase project (Postgres, Auth, Storage, RPC, RLS)
- **Source/CI:** GitHub

Do not add Cloudflare Workers or D1.

## Current status

Customer login and subscription payment-proof submission use Supabase Auth, the private Supabase Storage bucket, and existing payment-request RPCs. Proof submission is pending manual review and does not credit wallet balances. Subscription activation happens only after an authorized admin approval.

Customer wallet balance, transactions, and withdrawals remain unavailable until a verified ledger and withdrawal backend exist. This project must not be used to imply unverified payments are received or settled.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required Vite environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy public anon key)

Build:
```bash
npm run build
npm run preview
```

## Security principles

- Never expose Supabase service-role/secret keys in the frontend.
- All protected writes rely on Supabase Auth and RLS.
- Payment proof screenshots/UTRs are not authoritative verification.
- No wallet balance is credited by customer-submitted proof.
- Withdrawals remain disabled until backend controls, ledger, and verification are implemented.
