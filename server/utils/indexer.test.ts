import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexNote, removeNoteFromIndex } from './indexer'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const schema = readFileSync(join(__dirname, '../database/migrations/001_init.sql'), 'utf-8')
  db.exec(schema)
  return db
}

describe('indexer', () => {
  let db: Database.Database
  let vaultRoot: string

  beforeEach(() => {
    db = createTestDb()
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-indexer-'))
  })

  afterEach(() => {
    db.close()
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  function writeNote(relativePath: string, content: string): void {
    const abs = join(vaultRoot, relativePath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf-8')
  }

  it('indexes a note, extracting its tags and wikilinks into the DB', async () => {
    writeNote('target.md', '# Target\n')
    await indexNote(db, 'target.md', vaultRoot)

    writeNote('source.md', [
      '---',
      'title: Source Note',
      '---',
      '',
      'Some text with #project/alpha and #beta tags, mentioning zebras.',
      '',
      'A link to [[Target]] and to [[Target|display name]].',
      ''
    ].join('\n'))
    await indexNote(db, 'source.md', vaultRoot)

    const note = db.prepare('SELECT id, title FROM notes WHERE path = ?').get('source.md') as
      { id: number, title: string }
    expect(note.title).toBe('Source Note')

    const tagNames = db.prepare(`
      SELECT t.name FROM tags t
      JOIN note_tags nt ON nt.tag_id = t.id
      WHERE nt.note_id = ?
      ORDER BY t.name
    `).all(note.id).map((row) => (row as { name: string }).name)
    expect(tagNames).toEqual(['beta', 'project/alpha'])

    const target = db.prepare('SELECT id FROM notes WHERE path = ?').get('target.md') as { id: number }
    const links = db.prepare('SELECT target_note_id, target_raw FROM links WHERE source_note_id = ?')
      .all(note.id) as { target_note_id: number, target_raw: string }[]
    expect(links).toHaveLength(2)
    expect(links.every((link) => link.target_note_id === target.id)).toBe(true)
    expect(links.map((link) => link.target_raw).sort()).toEqual(['Target', 'Target|display name'])

    const ftsHits = db.prepare(`
      SELECT n.path FROM notes_fts f JOIN notes n ON n.id = f.rowid WHERE notes_fts MATCH 'zebras'
    `).all() as { path: string }[]
    expect(ftsHits).toEqual([{ path: 'source.md' }])
  })

  it('keeps target_note_id null for a wikilink to a note that does not exist, but stores target_raw', async () => {
    writeNote('note.md', 'See [[Nonexistent Note]] for details.')
    await indexNote(db, 'note.md', vaultRoot)

    const note = db.prepare('SELECT id FROM notes WHERE path = ?').get('note.md') as { id: number }
    const link = db.prepare('SELECT target_note_id, target_raw FROM links WHERE source_note_id = ?')
      .get(note.id) as { target_note_id: number | null, target_raw: string }

    expect(link.target_note_id).toBeNull()
    expect(link.target_raw).toBe('Nonexistent Note')
  })

  it('cascades tags, links and the FTS entry when a note is removed from the index', async () => {
    writeNote('target.md', '# Target\n')
    await indexNote(db, 'target.md', vaultRoot)

    writeNote('source.md', 'Tagged #cascade-test, linking to [[Target]].')
    await indexNote(db, 'source.md', vaultRoot)

    const note = db.prepare('SELECT id FROM notes WHERE path = ?').get('source.md') as { id: number }
    expect(db.prepare('SELECT COUNT(*) c FROM note_tags WHERE note_id = ?').get(note.id)).toMatchObject({ c: 1 })
    expect(db.prepare('SELECT COUNT(*) c FROM links WHERE source_note_id = ?').get(note.id)).toMatchObject({ c: 1 })

    removeNoteFromIndex(db, 'source.md')

    expect(db.prepare('SELECT * FROM notes WHERE path = ?').get('source.md')).toBeUndefined()
    expect(db.prepare('SELECT COUNT(*) c FROM note_tags WHERE note_id = ?').get(note.id)).toMatchObject({ c: 0 })
    expect(db.prepare('SELECT COUNT(*) c FROM links WHERE source_note_id = ?').get(note.id)).toMatchObject({ c: 0 })

    const ftsHits = db.prepare(`
      SELECT n.path FROM notes_fts f JOIN notes n ON n.id = f.rowid WHERE notes_fts MATCH 'cascade'
    `).all()
    expect(ftsHits).toHaveLength(0)

    // target.md itself was untouched - ON DELETE SET NULL only applies to
    // links pointing at a removed note, not the note we just removed.
    expect(db.prepare('SELECT * FROM notes WHERE path = ?').get('target.md')).toBeDefined()
  })
})
