# Admin panel preparation

Work is being prepared on the `admin-panel-prep` branch. Production `main` is kept unchanged until review and deployment.

## Changes prepared
- Transactions view: combined subscription proof, wallet top-up, and withdrawal request records with search and type/status filters. Records are requests/reviews and are not represented as independently verified payments.
- Admin settings: displays the current signed-in admin and Supabase MFA assurance status.
- Removed unused placeholder navigation for Settlements, Accounts, and Support rather than showing misleading sample data.
- Payment settings: retains UPI configuration and adds administrator controls for USDT asset, receiving address, network, instructions, enable/disable switch, and QR preview.
- Admin payment settings use a consistent dark operations UI.

## Required database migration
Before enabling crypto settings in a deployed environment, apply `database/migrations/0010_crypto_payment_config.sql` to the existing Supabase database. It is additive and does not reset existing data.

## Important limitations
- USDT checkout is not yet wired into customer payment submission. The admin configuration is prepared first; the customer payment method, transaction reference/hash validation, proof review fields, and network verification workflow must be implemented and reviewed before enabling crypto for customers.
- Payment approval remains manual. Screenshots are not payment verification.
- Do not enable a payment destination until the address and selected network have been independently verified.
- This branch must pass TypeScript/build checks and deployment review before merging into `main`.
