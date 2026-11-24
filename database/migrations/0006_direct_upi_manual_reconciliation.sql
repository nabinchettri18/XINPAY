-- Direct UPI orders remain pending until an Access-protected admin reconciles
-- the actual bank credit. This is an admin attestation, not automated bank verification.
CREATE INDEX IF NOT EXISTS payment_orders_provider_status_created
  ON payment_orders(provider, status, created_at DESC);
