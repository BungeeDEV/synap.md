CREATE TABLE IF NOT EXISTS archive (
  id INTEGER PRIMARY KEY,
  original_path TEXT NOT NULL,
  archived_path TEXT NOT NULL UNIQUE,
  archived_at INTEGER NOT NULL
);
