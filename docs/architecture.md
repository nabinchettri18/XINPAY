# XinPay foundation architecture

## Initial frontend

The frontend is a Vite-built React application deployed to Cloudflare Pages. It is intentionally static at this stage and displays demo-only data.

## Planned API

A separately deployed Cloudflare Worker will provide the API boundary. It will validate requests, authenticate users, enforce roles, and call provider integrations. API secrets must live in Worker secrets, never in the browser.

## Planned D1 data domains

- users, roles, and sessions
- transaction records and provider references
- settlement batches and status history
- verified settlement accounts and account-change requests
- support tickets
- audit events

## Payment lifecycle (planned)

1. Server creates a payment intent/order with a configured provider.
2. Client receives only the provider-approved checkout details.
3. Provider sends a signed webhook.
4. Worker verifies signature, validates event, and handles idempotency.
5. Database records the authoritative state.
6. Reconciliation jobs compare internal records with provider reports.

No payment or settlement functionality is active in this repository foundation.
