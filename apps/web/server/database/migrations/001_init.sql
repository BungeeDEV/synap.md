CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  frontmatter_json TEXT,
  mtime INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY,
  source_note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  target_raw TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_links_source_note_id ON links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_links_target_note_id ON links(target_note_id);

-- Self-contained FTS5 table (deliberately NOT "external content"/content='notes'):
-- FTS5's external-content mode requires its columns to exist under the exact
-- same names on the referenced table for reads/deletes to work, and notes has
-- no "content" column (the Markdown body is never duplicated into SQL, only
-- its plain-text extract, which lives only here). So FTS5 keeps its own copy
-- of title/content; rowid is kept aligned with notes.id by the indexer.
-- Maintained entirely by hand in server/utils/indexer.ts, never via triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content
);
