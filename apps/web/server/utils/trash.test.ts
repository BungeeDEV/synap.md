import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildTrashedPath, cleanupExpiredTrash } from './trash'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const schema = [
    readFileSync(join(__dirname, '../database/migrations/001_init.sql'), 'utf-8'),
    readFileSync(join(__dirname, '../database/migrations/002_settings_trash.sql'), 'utf-8')
  ].join('\n')
  db.exec(schema)
  return db
}

describe('trash', () => {
  let db: Database.Database
  let vaultRoot: string

  beforeEach(() => {
    db = createTestDb()
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-trash-'))
    mkdirSync(join(vaultRoot, '_trash'))
  })

  afterEach(() => {
    db.close()
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  describe('buildTrashedPath', () => {
    it('builds a path under _trash/ using the timestamp-prefixed, sanitized original name', async () => {
      const trashedPath = await buildTrashedPath('notes/My Note!.md', vaultRoot)
      expect(trashedPath).toMatch(/^_trash\/\d+-My-Note\.md$/)
    })

    it('appends a counter suffix when the generated name already exists', async () => {
      const first = await buildTrashedPath('note.md', vaultRoot)
      writeFileSync(join(vaultRoot, first), 'placeholder')

      const second = await buildTrashedPath('note.md', vaultRoot)
      expect(second).not.toBe(first)
      expect(existsSync(join(vaultRoot, second))).toBe(false)
    })
  })

  describe('cleanupExpiredTrash', () => {
    function insertTrashRow(trashedPath: string, deletedAt: number): void {
      writeFileSync(join(vaultRoot, trashedPath), 'content')
      db.prepare('INSERT INTO trash (original_path, trashed_path, deleted_at) VALUES (?, ?, ?)')
        .run(trashedPath.replace('_trash/', ''), trashedPath, deletedAt)
    }

    it('permanently deletes files and rows older than the retention window, leaving newer ones untouched', async () => {
      const dayMs = 24 * 60 * 60 * 1000
      insertTrashRow('_trash/old.md', Date.now() - 31 * dayMs)
      insertTrashRow('_trash/recent.md', Date.now() - 1 * dayMs)

      await cleanupExpiredTrash(db, vaultRoot, 30)

      expect(existsSync(join(vaultRoot, '_trash/old.md'))).toBe(false)
      expect(existsSync(join(vaultRoot, '_trash/recent.md'))).toBe(true)

      const rows = db.prepare('SELECT trashed_path FROM trash').all() as { trashed_path: string }[]
      expect(rows).toEqual([{ trashed_path: '_trash/recent.md' }])
    })

    it('removes the DB row even if the underlying file is already gone', async () => {
      const dayMs = 24 * 60 * 60 * 1000
      db.prepare('INSERT INTO trash (original_path, trashed_path, deleted_at) VALUES (?, ?, ?)')
        .run('gone.md', '_trash/gone.md', Date.now() - 31 * dayMs)

      await cleanupExpiredTrash(db, vaultRoot, 30)

      expect(db.prepare('SELECT COUNT(*) c FROM trash').get()).toMatchObject({ c: 0 })
    })
  })
})
