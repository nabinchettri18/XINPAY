-- XINPAY payment prototype schema (Cloudflare D1 / SQLite)
-- Not production-ready. Requires authenticated admin API and an authorized payment-confirmation source.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payment_config (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  receiving_upi_id TEXT,
  beneficiary_display_name TEXT,
  qr_asset_key TEXT,
  qr_mode TEXT NOT NULL DEFAULT 'uploaded' CHECK (qr_mode IN ('generated', 'uploaded')),
  instructions TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  purpose TEXT NOT NULL,
  expected_amount_minor INTEGER NOT NULL CHECK (expected_amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','pending','processing','paid','failed','expired','review')),
  destination_config_version INTEGER,
  destination_snapshot TEXT,
  external_reference TEXT UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES payment_orders(id),
  source TEXT NOT NULL,
  external_reference TEXT,
  event_type TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT,
  verification_state TEXT NOT NULL
    CHECK (verification_state IN ('verified','rejected','review','unverified')),
  event_hash TEXT UNIQUE,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_source_reference_unique
  ON payment_events(source, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_orders_status_created
  ON payment_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  before_snapshot TEXT,
  after_snapshot TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
