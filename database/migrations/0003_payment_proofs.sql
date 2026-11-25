CREATE TABLE IF NOT EXISTS payment_proof_submissions (
  id TEXT PRIMARY KEY,
  amount_minor INTEGER NOT NULL,
  utr TEXT NOT NULL UNIQUE,
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  proof_mime TEXT NOT NULL,
  proof_base64 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proof_submissions(status, submitted_at);
