CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
