ALTER TABLE users ADD COLUMN preferences_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS trash (
  id INTEGER PRIMARY KEY,
  original_path TEXT NOT NULL,
  trashed_path TEXT NOT NULL UNIQUE,
  deleted_at INTEGER NOT NULL
);
