import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexNote } from './indexer'
import { propagatePathWikilinkRename, propagateWikilinkRename } from './renamePropagation'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const migrationsDir = join(__dirname, '../database/migrations')
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf-8'))
  }
  return db
}

describe('renamePropagation', () => {
  let db: Database.Database
  let vaultRoot: string

  beforeEach(() => {
    db = createTestDb()
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-rename-propagation-'))
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

  function readNote(relativePath: string): string {
    return readFileSync(join(vaultRoot, relativePath), 'utf-8')
  }

  describe('propagateWikilinkRename (title-based)', () => {
    it('rewrites [[oldTitle]] and [[oldTitle|Alias]] backlinks and reindexes them', async () => {
      writeNote('target.md', '# Target\n')
      await indexNote(db, 'target.md', vaultRoot)
      const target = db.prepare('SELECT id FROM notes WHERE path = ?').get('target.md') as { id: number }

      writeNote('source.md', 'See [[Target]] and [[Target|display]].')
      await indexNote(db, 'source.md', vaultRoot)

      const updated = await propagateWikilinkRename(db, target.id, 'Target', 'Renamed Target', vaultRoot)

      expect(updated).toEqual(['source.md'])
      expect(readNote('source.md')).toBe('See [[Renamed Target]] and [[Renamed Target|display]].')

      const ftsHits = db.prepare(`
        SELECT n.path FROM notes_fts f JOIN notes n ON n.id = f.rowid WHERE notes_fts MATCH 'Target'
      `).all() as { path: string }[]
      expect(ftsHits.map((h) => h.path).sort()).toEqual(['source.md', 'target.md'])
    })
  })

  describe('propagatePathWikilinkRename (path-literal)', () => {
    it('rewrites a full-path wikilink, with and without the .md extension, preserving alias', async () => {
      writeNote('Projects/target.md', '# Target\n')
      await indexNote(db, 'Projects/target.md', vaultRoot)
      const target = db.prepare('SELECT id FROM notes WHERE path = ?').get('Projects/target.md') as { id: number }

      writeNote('source.md', 'See [[Projects/target.md]] and [[Projects/target|display]].')
      await indexNote(db, 'source.md', vaultRoot)

      const updated = await propagatePathWikilinkRename(db, target.id, 'Projects/target.md', 'Work/target.md', vaultRoot)

      expect(updated).toEqual(['source.md'])
      expect(readNote('source.md')).toBe('See [[Work/target.md]] and [[Work/target|display]].')
    })

    it('does not touch a bare-filename wikilink - the filename is unaffected by a folder move', async () => {
      writeNote('Projects/target.md', '# Target\n')
      await indexNote(db, 'Projects/target.md', vaultRoot)
      const target = db.prepare('SELECT id FROM notes WHERE path = ?').get('Projects/target.md') as { id: number }

      writeNote('source.md', 'See [[target]].')
      await indexNote(db, 'source.md', vaultRoot)

      const updated = await propagatePathWikilinkRename(db, target.id, 'Projects/target.md', 'Work/target.md', vaultRoot)

      expect(updated).toEqual([])
      expect(readNote('source.md')).toBe('See [[target]].')
    })

    it('matches case-insensitively', async () => {
      writeNote('Projects/target.md', '# Target\n')
      await indexNote(db, 'Projects/target.md', vaultRoot)
      const target = db.prepare('SELECT id FROM notes WHERE path = ?').get('Projects/target.md') as { id: number }

      writeNote('source.md', 'See [[projects/TARGET.md]].')
      await indexNote(db, 'source.md', vaultRoot)

      const updated = await propagatePathWikilinkRename(db, target.id, 'Projects/target.md', 'Work/target.md', vaultRoot)

      expect(updated).toEqual(['source.md'])
      expect(readNote('source.md')).toBe('See [[Work/target.md]].')
    })

    it('is a no-op when oldPath equals newPath', async () => {
      writeNote('Projects/target.md', '# Target\n')
      await indexNote(db, 'Projects/target.md', vaultRoot)
      const target = db.prepare('SELECT id FROM notes WHERE path = ?').get('Projects/target.md') as { id: number }

      const updated = await propagatePathWikilinkRename(db, target.id, 'Projects/target.md', 'Projects/target.md', vaultRoot)
      expect(updated).toEqual([])
    })
  })
})
