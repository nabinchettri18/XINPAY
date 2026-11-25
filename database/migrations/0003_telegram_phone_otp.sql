CREATE TABLE IF NOT EXISTS telegram_phone_verifications (
  id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL,
  link_token_hash TEXT NOT NULL UNIQUE,
  telegram_user_id TEXT,
  telegram_chat_id TEXT,
  otp_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending_link' CHECK (status IN ('pending_link','linked','otp_sent','verified','expired','failed')),
  link_expires_at TEXT NOT NULL,
  otp_expires_at TEXT,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT
);
CREATE INDEX IF NOT EXISTS telegram_verifications_phone_created
  ON telegram_phone_verifications(phone_e164, created_at DESC);
CREATE INDEX IF NOT EXISTS telegram_verifications_status_expiry
  ON telegram_phone_verifications(status, link_expires_at, otp_expires_at);
