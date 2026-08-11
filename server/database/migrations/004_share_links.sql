CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  password_hash TEXT,
  max_views INTEGER,
  current_views INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  require_login INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_links_note_id ON share_links(note_id);
