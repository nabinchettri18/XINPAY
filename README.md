# XinPay

XinPay is a payment-operations application foundation.

## Architecture

- **Frontend and deployment:** Vercel (React + TypeScript + Vite)
- **Serverless APIs:** Vercel Functions under `api/`
- **Database, auth, storage, RPC and RLS:** Existing Supabase project
- **Source and CI:** GitHub
- **Phone verification:** Telegram Bot API webhook handled by Vercel

Cloudflare Workers and D1 are not part of the target architecture.

## Existing data

The Supabase project already contains payment configuration, subscription payment requests, customer wallet and withdrawal records, bank-account profiles, payment events, ledger tables, audit logs, and security RPCs. Migration work is additive and must not replace or reset this database.

## Current status and safety

XinPay is not a licensed payment processor. QR display and uploaded payment proof do not independently verify a payment. Wallet credits, subscriptions, and payouts must only be applied after trusted verification and authorized review. Phone verification does not establish financial identity or authorize withdrawals.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Vite environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only Vercel environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or Supabase secret key)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `OTP_HASH_SECRET`
- `APP_ORIGIN` (optional; supports comma-separated origins)

Never put service keys, bot tokens, webhook secrets, or OTP hash secrets in frontend `VITE_*` variables or commit them.

## Telegram phone verification

1. Customer signs in and starts verification in Profile.
2. XinPay creates a short-lived link token and the customer opens the bot.
3. The customer presses Start and shares their own Telegram contact.
4. Backend matches the shared phone number, sends a 6-digit OTP, and verifies it.
5. Link token expires in 10 minutes; OTP expires in 5 minutes; verification allows at most 5 attempts.

Webhook endpoint:
`https://<production-domain>/api/telegram/webhook`

Configure Telegram's webhook using the bot token and the same `TELEGRAM_WEBHOOK_SECRET` stored in Vercel. Do not paste the bot token into chat.

## Deployment

Vercel project: `xinpay`, root directory `/`, build command `npm run build`, output directory `dist`. GitHub auto-deployment requires a Vercel GitHub Login Connection for the repository. If that connection is not yet authorized, connect it in Vercel and then enable production deploys from `main`.

The migration branch is intentionally not production-deployed until the build, API configuration, and required server secrets are validated.
