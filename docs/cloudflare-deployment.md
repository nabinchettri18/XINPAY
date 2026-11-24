# Cloudflare deployment: XinPay frontend + UPI configuration API

The Cloudflare Worker serves the Vite-built customer/admin frontend from `dist/` and routes `/api/*` requests to the Worker API. D1 stores admin-managed UPI display configuration. Payment collection and payment verification are **not** implemented.

## Cloudflare resources already provisioned

- Worker: `xinpay`
- Production URL: `https://xinpay.nabinchettri0007.workers.dev`
- D1 database: `xinpay`
- D1 database ID: `01a0150b-0688-42f7-89b7-8e305ae5f48c`
- Migration tables: `payment_config`, `audit_logs`

These values are already configured in `wrangler.toml`.

## D1 schema

The migration at `database/migrations/0001_payment_config.sql` has been applied to the production D1 database.

If recreating the database:

```bash
npx wrangler d1 create xinpay
# Copy the database_id into wrangler.toml
npx wrangler d1 migrations apply xinpay --remote
```

## Worker secret

Set a random, long `ADMIN_TOKEN` as a Worker secret. Never commit it or expose it in a `VITE_*` variable.

```bash
openssl rand -hex 32
npx wrangler secret put ADMIN_TOKEN
```

## Deployment

The Worker configuration serves static Vite assets from `dist/` and runs the API first for `/api/*`.

```bash
npm install
npm run build
npx wrangler deploy
```

The Cloudflare Git build settings use `npm run build` and `npx wrangler deploy` from repository root. The Worker production origin is configured in `ALLOWED_ORIGIN`.

## API

- `GET /api/payment-config`: public read of the UPI collection display configuration.
- `PUT /api/payment-config`: requires `Authorization: Bearer <ADMIN_TOKEN>`; validates UPI ID and logs config changes.

## Configure UPI

Open **Admin → Payment Settings**, enter the Worker admin token in the Admin API token field, configure the receiving UPI ID and payee name, and save. The token is kept in sessionStorage for that browser session.

Customer portal requests the public configuration from the API and builds the UPI QR / intent from it. The same config is shared across users and devices.

## Security limitations / production checklist

- This prototype uses one shared admin token. Replace it with real admin authentication, role-based authorization, short-lived sessions, CSRF protection where cookie auth is used, and audit identity before production.
- Rotate the Worker token if it is exposed; never commit it or share it in chat.
- Restrict `ALLOWED_ORIGIN` to the frontend domain.
- This endpoint only manages displayed UPI details. It does not confirm incoming transfers, reconcile bank statements, or mark payments as paid.
- For real payments, integrate a regulated payment provider or a trusted bank reconciliation mechanism, verify callbacks server-side, use idempotency, and maintain an auditable ledger.
