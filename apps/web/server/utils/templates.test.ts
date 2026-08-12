import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNoteFromTemplate, listTemplates, renderTemplate, TemplateNotFoundError } from './templates'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const schema = readFileSync(join(__dirname, '../database/migrations/001_init.sql'), 'utf-8')
  db.exec(schema)
  return db
}

describe('templates', () => {
  let db: Database.Database
  let vaultRoot: string

  beforeEach(() => {
    db = createTestDb()
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-templates-'))
    mkdirSync(join(vaultRoot, '_templates'))
  })

  afterEach(() => {
    db.close()
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  describe('listTemplates', () => {
    it('returns an empty list when _templates/ does not exist yet', async () => {
      rmSync(join(vaultRoot, '_templates'), { recursive: true, force: true })
      expect(await listTemplates(vaultRoot)).toEqual([])
    })

    it('lists only .md files, sorted by name, ignoring subfolders', async () => {
      writeFileSync(join(vaultRoot, '_templates/Meeting.md'), '')
      writeFileSync(join(vaultRoot, '_templates/Daily.md'), '')
      writeFileSync(join(vaultRoot, '_templates/notes.txt'), '')
      mkdirSync(join(vaultRoot, '_templates/nested'))

      expect(await listTemplates(vaultRoot)).toEqual([
        { name: 'Daily', path: '_templates/Daily.md' },
        { name: 'Meeting', path: '_templates/Meeting.md' }
      ])
    })
  })

  describe('renderTemplate', () => {
    it('replaces {{date}}, {{time}}, {{datetime}} and {{title}} tokens', () => {
      const now = new Date(2026, 6, 16, 9, 5)
      const result = renderTemplate('# {{title}}\n\n{{date}} {{time}} ({{datetime}})', { title: 'My Note', now })
      expect(result).toBe('# My Note\n\n2026-07-16 09:05 (2026-07-16 09:05)')
    })
  })

  describe('createNoteFromTemplate', () => {
    it('writes an empty note and indexes it when templateName is null', async () => {
      const result = await createNoteFromTemplate(db, 'plain.md', null, vaultRoot)
      expect(readFileSync(join(vaultRoot, 'plain.md'), 'utf-8')).toBe('')
      expect(result.path).toBe('plain.md')
      expect(db.prepare('SELECT path FROM notes WHERE path = ?').get('plain.md')).toBeDefined()
    })

    it('renders the template content into the new note', async () => {
      writeFileSync(join(vaultRoot, '_templates/Daily.md'), '# {{title}}\n\nCreated {{date}}.')

      await createNoteFromTemplate(db, 'Tagesplanung/2026-07-16.md', 'Daily', vaultRoot)

      const content = readFileSync(join(vaultRoot, 'Tagesplanung/2026-07-16.md'), 'utf-8')
      expect(content).toContain('# 2026-07-16')
      expect(content).toContain('Created ')
    })

    it('throws TemplateNotFoundError when the referenced template does not exist', async () => {
      await expect(createNoteFromTemplate(db, 'note.md', 'Missing', vaultRoot)).rejects.toThrow(TemplateNotFoundError)
    })
  })
})
