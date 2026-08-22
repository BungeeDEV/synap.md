import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexNote } from './indexer'
import { getVaultHealthReport } from './vaultHealth'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const migrationsDir = join(__dirname, '../database/migrations')
  const { readdirSync } = require('node:fs')
  const files = readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort()
  for (const file of files) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf-8'))
  }
  return db
}

describe('getVaultHealthReport', () => {
  let db: Database.Database
  let vaultRoot: string

  beforeEach(() => {
    db = createTestDb()
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-health-'))
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

  it('reports an empty vault as having no issues', async () => {
    const report = await getVaultHealthReport(db, vaultRoot)
    expect(report.brokenLinks).toEqual([])
    expect(report.orphanedNotes).toEqual([])
    expect(report.checkedAt).toEqual(expect.any(String))
  })

  it('lists a wikilink to a nonexistent note as a broken link, grouping repeats into one entry with a count', async () => {
    writeNote('source.md', '---\ntitle: Source\n---\n\nSee [[Missing Note]] and again [[Missing Note]].')
    await indexNote(db, 'source.md', vaultRoot)

    const report = await getVaultHealthReport(db, vaultRoot)
    expect(report.brokenLinks).toEqual([
      { path: 'source.md', title: 'Source', target: 'Missing Note', occurrences: 2 }
    ])
  })

  it('does not flag a wikilink that resolves to a real note', async () => {
    writeNote('target.md', '# Target\n')
    await indexNote(db, 'target.md', vaultRoot)
    writeNote('source.md', 'Links to [[Target]].')
    await indexNote(db, 'source.md', vaultRoot)

    const report = await getVaultHealthReport(db, vaultRoot)
    expect(report.brokenLinks).toEqual([])
  })

  it('lists a note nobody links to as orphaned', async () => {
    writeNote('lonely.md', '---\ntitle: Lonely\n---\n\n# Lonely\n')
    await indexNote(db, 'lonely.md', vaultRoot)

    const report = await getVaultHealthReport(db, vaultRoot)
    expect(report.orphanedNotes).toEqual([{ path: 'lonely.md', title: 'Lonely' }])
  })

  it('does not flag a note that has at least one incoming link', async () => {
    writeNote('target.md', '# Target\n')
    await indexNote(db, 'target.md', vaultRoot)
    writeNote('source.md', 'Links to [[Target]].')
    await indexNote(db, 'source.md', vaultRoot)

    const report = await getVaultHealthReport(db, vaultRoot)
    // source.md itself has no incoming links either, so it's still orphaned -
    // only target.md (which is linked to) is excluded.
    expect(report.orphanedNotes.map((n) => n.path)).toEqual(['source.md'])
  })

  it('omits stale index entries for files removed from disk without a reindex', async () => {
    writeNote('gone.md', '# Gone\n')
    await indexNote(db, 'gone.md', vaultRoot)
    writeNote('source.md', 'Links to [[Missing]].')
    await indexNote(db, 'source.md', vaultRoot)

    // Simulate an out-of-band deletion: the DB still thinks gone.md exists.
    unlinkSync(join(vaultRoot, 'gone.md'))

    const report = await getVaultHealthReport(db, vaultRoot)
    expect(report.orphanedNotes.some((n) => n.path === 'gone.md')).toBe(false)
  })
})
