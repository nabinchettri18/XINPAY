-- IP-hashed, fixed-window rate limit for admin API writes.
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  window_started TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
