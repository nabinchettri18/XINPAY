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

The migrations at `database/migrations/` must be applied to the production D1 database, including the admin write rate-limit table in `0002_rate_limits.sql`.

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

Before deploying, apply the new migration to production D1:

```bash
npx wrangler d1 migrations apply xinpay --remote
```

Then deploy:

```bash
npm run build
npx wrangler deploy
```

The Cloudflare Git build settings use `npm run build` and `npx wrangler deploy` from repository root. The Worker production origin is configured in `ALLOWED_ORIGIN`.

## API

- `GET /api/payment-config`: public read of only the customer-facing UPI display fields. No internal audit metadata is returned.
- `PUT /api/payment-config`: requires `Authorization: Bearer <ADMIN_TOKEN>`; validates payload types and size, validates UPI ID, and logs config changes.
- Unknown `/api/*` paths return JSON 404 instead of falling through to the frontend.
- API and static responses include security headers; API responses are not cached.
- Admin configuration writes are rate-limited to 20 attempts per IP-hash per 10-minute window. If the rate-limit table is missing, admin writes fail closed.
- Cross-origin API requests are rejected unless the request Origin matches `ALLOWED_ORIGIN`.

**Routes are not secrets.** Browser-facing API URLs can be discovered in DevTools/network requests. Security comes from server-side authorization, validation, rate limiting, and limiting returned data—not hiding the URL.

## Configure UPI

Open **Admin → Payment Settings**, enter the Worker admin token in the Admin API token field, configure the receiving UPI ID and payee name, and save. The token is held in page memory only; reload the page and you must enter it again. Do not paste it into a shared computer or expose it in screenshots.

Customer portal requests the public configuration from the API and builds the UPI QR / intent from it. The same config is shared across users and devices.


## Customer sign-in and account creation

Customer authentication uses the Worker and D1 database. It is separate from the admin Cloudflare Access identity gate.

Apply all D1 migrations, including `0007_customer_auth.sql`, before using authentication:

```bash
npx wrangler d1 migrations apply xinpay --remote
```

Configure a verified sender domain in Resend, then add these Worker secrets:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put AUTH_EMAIL_FROM
```

Set `PUBLIC_BASE_URL` to the public customer-facing XinPay origin (for example, the HTTPS URL that serves the customer portal). The email verification and password-reset links are generated from this origin.

Customer auth endpoints:
- `POST /api/auth/register`: create an unverified customer and email a verification link.
- `POST /api/auth/verify-email`: consume the single-use verification token and create a session.
- `POST /api/auth/login` and `POST /api/auth/logout`: issue and revoke customer sessions.
- `GET /api/auth/me`: return the current verified customer identity.
- `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`: issue and consume single-use reset links.
- `POST /api/auth/resend-verification`: resend a verification email without disclosing whether an address is registered.

Passwords are stored as PBKDF2 hashes, never as plain text. Session tokens are random, stored only as hashes in D1, and delivered in Secure, HttpOnly, SameSite=Lax cookies. Verification and reset tokens expire after 30 minutes and are single-use. Auth mutation routes enforce an Origin check and use the existing IP-hash rate limiter.

The login flow is not enabled until the D1 migration and Resend sender configuration are complete. Do not put the Resend key in a frontend `VITE_*` variable. This customer session layer does not authenticate the admin dashboard; keep the admin hostname/API behind Cloudflare Access as described below.

## Admin access protection (required before production)

The admin dashboard itself is a static frontend and is not authenticated by the Worker. The token protects only configuration writes. Before production, protect the admin surface with Cloudflare Access (prefer a separate admin hostname) and allow only named administrators. Do not expose an admin dashboard on the same public host without an identity gate. This setup must be completed in the Cloudflare dashboard; it is not configured by repository code.

## Security limitations / production checklist

- This prototype uses one shared admin token. Replace it with real admin authentication, role-based authorization, short-lived sessions, CSRF protection where cookie auth is used, and audit identity before production.
- Rotate the Worker token if it is exposed; never commit it or share it in chat.
- Restrict `ALLOWED_ORIGIN` to the frontend domain.
- This endpoint only manages displayed UPI details. It does not confirm incoming transfers, reconcile bank statements, or mark payments as paid.
- For real payments, integrate a regulated payment provider or a trusted bank reconciliation mechanism, verify callbacks server-side, use idempotency, and maintain an auditable ledger.
