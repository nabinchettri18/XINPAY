# Vercel + Supabase deployment

## Vercel project
- Project: `xinpay`
- Root: repository root
- Framework: Vite
- Build command: `npm run build`
- Output: `dist`
- Serverless routes: `api/telegram/**`

## Required environment variables

Client-safe:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or current Supabase secret key)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `OTP_HASH_SECRET`
- `APP_ORIGIN`

Do not expose server secrets with a `VITE_` prefix or commit them.

## Telegram webhook
Configure the Telegram bot webhook to:
`https://<production-domain>/api/telegram/webhook`

Set `secret_token` to the exact `TELEGRAM_WEBHOOK_SECRET` value in Vercel. Telegram will send that value in `X-Telegram-Bot-Api-Secret-Token`. Register the webhook from a private terminal; do not paste the bot token into chat or repository files.

## Database
Migration `0005_telegram_phone_verification.sql` and `0006_telegram_verification_user_binding.sql` are additive. They create server-only verification and rate-limit tables and RPCs. RLS is enabled without public/authenticated policies; Vercel server functions use a server-only key. Existing payment, customer, wallet, settlement, and audit tables are not replaced.

## Production cutover
1. Connect the GitHub repository through Vercel's Login Connection.
2. Set production and preview environment variables.
3. Deploy the migration branch to Preview and run tests.
4. Set Telegram webhook only after the production URL is confirmed.
5. Merge the migration PR and verify the production deployment.
