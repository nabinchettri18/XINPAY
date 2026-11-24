PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS payment_config (
 id TEXT PRIMARY KEY DEFAULT 'primary',
 enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
 receiving_upi_id TEXT,
 beneficiary_display_name TEXT,
 qr_asset_key TEXT,
 qr_mode TEXT NOT NULL DEFAULT 'generated' CHECK (qr_mode IN ('generated','uploaded')),
 instructions TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by TEXT
);
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
