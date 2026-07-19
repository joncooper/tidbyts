CREATE TABLE IF NOT EXISTS token_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('codex', 'claude')),
  observed_at INTEGER NOT NULL,
  token_type TEXT NOT NULL CHECK (
    token_type IN ('input', 'output', 'cache_read', 'cache_write')
  ),
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  model TEXT
);

CREATE INDEX IF NOT EXISTS idx_token_events_observed_provider
  ON token_events(observed_at, provider);

CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY CHECK (id IN ('a', 'b')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT OR IGNORE INTO household_members (id, name, sort_order)
VALUES ('a', 'JON', 0), ('b', 'PARTNER', 1);

CREATE TABLE IF NOT EXISTS junk_bins (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES household_members(id),
  label TEXT NOT NULL DEFAULT '',
  dealt INTEGER NOT NULL DEFAULT 0 CHECK (dealt IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  dealt_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_junk_bins_member_dealt
  ON junk_bins(member_id, dealt, created_at);

CREATE TABLE IF NOT EXISTS snapshots (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

