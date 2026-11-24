# XINPAY Payment Configuration & Verification Blueprint

## Status
Prototype-only. No live payment collection, settlement changes, or automatic verification is implemented.

## Admin configuration
- Receiving UPI ID and display name
- QR upload/replace/remove
- Customer-facing instructions
- Collection display toggle
- Configuration versioning
- Admin audit events
- Sensitive changes require re-authentication

The UPI display configuration is now stored in Cloudflare D1 through the Worker API when deployed. Admin writes use a shared Worker secret token in this prototype; replace this with proper admin authentication before production. Payment verification is not connected.

## Suggested data model

### payment_config
- id (primary key)
- enabled (boolean)
- receiving_upi_id (text, nullable)
- beneficiary_display_name (text, nullable)
- qr_asset_key (text, nullable)
- qr_mode (enum: generated, uploaded)
- instructions (text)
- version (integer)
- updated_at (timestamp)
- updated_by (admin id)

### payment_orders
- id (uuid, primary key)
- user_id
- purpose (actual goods/services; not account activation or unlock deposits)
- expected_amount_minor (integer)
- currency (INR)
- status (created, pending, processing, paid, failed, expired, review)
- destination_config_version
- destination_snapshot (JSON)
- expires_at
- created_at

### payment_events
- id (uuid, primary key)
- order_id
- source
- external_reference (unique where supplied)
- event_type
- amount_minor
- currency
- verification_state
- event_hash
- received_at

### audit_logs
- id
- actor_id
- action
- target
- before_snapshot
- after_snapshot
- request_id
- created_at

## Verification
A payment can become paid only after a trusted, authorized payment confirmation source verifies it server-side. The verifier must validate:
- Authenticity/signature of the event where applicable
- Successful state
- Exact amount and currency
- Destination/payment account match
- Order/reference association
- Duplicate event/reference prevention
- Event time and order expiry rules

User-submitted screenshots, UTR strings, or "I paid" buttons are not proof. Unmatched or uncertain items stay in review/pending.

## Configuration change safety
- Existing orders keep a snapshot of the destination/config version used when created.
- Destination changes are audited.
- Sensitive changes require re-authentication and confirmation.
- Collection can be disabled independently.
- QR assets are validated, size-limited and access-controlled.
- Never store UPI PINs, OTPs, banking passwords, or card PINs.

## Suggested API
- GET /api/payment-config (public display config)\n- PUT /api/payment-config (admin-token protected config update)
- POST /api/payment-orders
- GET /api/payment-orders/:id
- POST /api/payment-events (trusted source only; signature validation)
- GET /api/admin/payment-config
- PUT /api/admin/payment-config
- POST /api/admin/payment-config/disable
- GET /api/admin/payments
- GET /api/admin/payments/review
- POST /api/admin/payments/:id/review
- GET /api/admin/audit-logs

## Deployment gates
Do not enable live payment state until an authorized confirmation source, backend auth, secret management, audit logging, reconciliation, and security review are implemented.
