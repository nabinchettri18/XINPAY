# Payment proof workflow

1. Customer signs in with Supabase Auth.
2. Customer creates a subscription payment request using `create_subscription_payment_request`.
3. Customer pays the configured UPI destination outside XinPay.
4. Customer uploads image proof into the private `xinpay-subscription-proofs` bucket using a UID/request scoped path.
5. The `submit_subscription_payment_proof` RPC validates request ownership, UTR, path, and uploaded object, then marks the request submitted.
6. An authorized administrator reviews the submission. The existing review RPC activates the subscription only on approval.

Proof submission is not payment verification and does not credit wallet balances. Balance and withdrawal operations remain disabled until a verified ledger and withdrawal service are implemented.
