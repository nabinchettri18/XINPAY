-- Ensure a verified event can produce at most one ledger posting.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_source_event_unique
 ON ledger_entries(source_event_id) WHERE source_event_id IS NOT NULL;
