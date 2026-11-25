# XinPay architecture

- Frontend and deployment: Vercel (Vite/React).
- Backend and database: the existing Supabase project (Postgres, Auth, Storage, RPC, and RLS).
- Repository and CI: GitHub Actions.

Do not introduce Cloudflare Workers or D1. Customer payment proof uses Supabase Auth, the private `xinpay-subscription-proofs` Storage bucket, and the existing subscription-payment RPCs. Manual review is required; proof submissions never directly credit wallet balances.
