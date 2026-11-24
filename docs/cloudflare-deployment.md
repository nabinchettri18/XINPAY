# Cloudflare backend deployment: UPI configuration

This adds a Cloudflare Worker API and D1 storage for admin-controlled UPI configuration. Payment collection and payment verification are still **not** implemented.

## 1. Create the D1 database

From the repository root:

```bash
npx wrangler d1 create xinpay
```

Copy the returned database ID into `wrangler.toml` in `database_id`.

## 2. Apply the migration

```bash
npx wrangler d1 migrations apply xinpay --remote
```

The migration creates `payment_config` and `audit_logs`.

## 3. Set the admin token secret

Generate a long random token locally (do not send it in chat or commit it):

```bash
openssl rand -hex 32
npx wrangler secret put ADMIN_TOKEN
```

Paste the generated value into the Cloudflare secret prompt. This token authorizes the Admin Payment Settings API write endpoint. Do not put it in a `VITE_*` environment variable.

## 4. Configure the API origin

Edit `wrangler.toml` and set `ALLOWED_ORIGIN` to your exact production frontend origin, e.g. `https://your-pages-domain.pages.dev`. Avoid a wildcard in production.

Deploy the Worker:

```bash
npm install
npx wrangler deploy
```

Copy the deployed Worker URL.

## 5. Configure Cloudflare Pages

Set a Pages environment variable:

```
VITE_API_BASE_URL=https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev
```

Set it for Production (and separately Preview if needed), then trigger a new Pages build/deployment.

## 6. Configure UPI in XinPay Admin

Open **Admin → Payment Settings**, enter the Worker admin token in the Admin API token field, configure the receiving UPI ID and payee name, and save. The token is kept in sessionStorage for that browser session.

Customer portal requests the public configuration from the API and builds the UPI QR / intent from it. The same config is now shared across users and devices.

## API

- `GET /api/payment-config`: public read of only the UPI collection display configuration.
- `PUT /api/payment-config`: requires `Authorization: Bearer <ADMIN_TOKEN>`; validates UPI ID and logs config changes.

## Security limitations / production checklist

- This prototype uses one shared admin token. Replace it with real admin authentication, role-based authorization, short-lived sessions, CSRF protection where cookie auth is used, and audit identity before production.
- Rotate the Worker token if it is exposed; never commit it or share it in chat.
- Restrict `ALLOWED_ORIGIN` to the frontend domain.
- This endpoint only manages displayed UPI details. It does not confirm incoming transfers, reconcile bank statements, or mark payments as paid.
- For real payments, integrate a regulated payment provider or a trusted bank reconciliation mechanism, verify callbacks server-side, use idempotency, and maintain an auditable ledger.
