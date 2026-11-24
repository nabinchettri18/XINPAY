-- API auth token hashes and provider state constraints.
ALTER TABLE payment_orders ADD COLUMN customer_access_hash TEXT;
ALTER TABLE payment_orders ADD COLUMN provider_status TEXT;
ALTER TABLE payment_orders ADD COLUMN failure_reason TEXT;
CREATE INDEX IF NOT EXISTS payment_orders_provider_id ON payment_orders(provider_order_id);
