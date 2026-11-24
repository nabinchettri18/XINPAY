-- Durable payment orders and provider event ledger.
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'cashfree',
  provider_order_id TEXT UNIQUE,
  customer_id TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  purpose TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','processing','paid','failed','expired','review')),
  payment_session_id TEXT,
  payment_link TEXT,
  destination_config_version INTEGER,
  destination_snapshot TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payment_orders_created ON payment_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_status ON payment_orders(status, created_at DESC);
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES payment_orders(id),
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  provider_reference TEXT,
  event_type TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT,
  verification_state TEXT NOT NULL CHECK (verification_state IN ('verified','rejected','review','unverified')),
  payload_hash TEXT NOT NULL UNIQUE,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_event_unique
 ON payment_events(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_reference_unique
 ON payment_events(provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES payment_orders(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payment_received','refund','adjustment')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  source_event_id TEXT REFERENCES payment_events(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ledger_order ON ledger_entries(order_id, created_at);
