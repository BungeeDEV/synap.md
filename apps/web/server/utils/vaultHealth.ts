import { stat } from 'node:fs/promises'
import type Database from 'better-sqlite3'
import { resolveVaultPath } from './vault-path'

export interface BrokenLink {
  path: string
  title: string
  target: string
  occurrences: number
}

export interface OrphanedNote {
  path: string
  title: string
}

export interface VaultHealthReport {
  brokenLinks: BrokenLink[]
  orphanedNotes: OrphanedNote[]
  checkedAt: string
}

/**
 * The DB is only reindexed on app-driven writes/deletes - a file removed
 * directly on disk (outside the app) leaves a stale index row until the next
 * full reindex, so double-check every referenced path still exists (same
 * guard as backlinks.get.ts).
 */
async function filterStale<T extends { path: string }>(vaultRoot: string, rows: T[]): Promise<T[]> {
  const exists = await Promise.all(rows.map(async (row) => {
    try {
      await stat(resolveVaultPath(row.path, vaultRoot))
      return true
    } catch {
      return false
    }
  }))
  return rows.filter((_, i) => exists[i])
}

/**
 * Surfaces two vault-wide issues, both derivable purely from the existing
 * links/notes index (see indexer.ts) - no extra data model: wikilinks that
 * don't resolve to any note, and notes nobody links to.
 */
export async function getVaultHealthReport(db: Database.Database, vaultRoot: string): Promise<VaultHealthReport> {
  const brokenRows = db.prepare(`
    SELECT n.path as path, n.title as title, l.target_raw as target, COUNT(*) as occurrences
    FROM links l
    JOIN notes n ON n.id = l.source_note_id
    WHERE l.target_note_id IS NULL
    GROUP BY n.id, l.target_raw
    ORDER BY n.title COLLATE NOCASE, l.target_raw COLLATE NOCASE
  `).all() as BrokenLink[]

  const orphanRows = db.prepare(`
    SELECT n.path as path, n.title as title
    FROM notes n
    WHERE NOT EXISTS (SELECT 1 FROM links l WHERE l.target_note_id = n.id)
    ORDER BY n.title COLLATE NOCASE
  `).all() as OrphanedNote[]

  const [brokenLinks, orphanedNotes] = await Promise.all([
    filterStale(vaultRoot, brokenRows),
    filterStale(vaultRoot, orphanRows)
  ])

  return { brokenLinks, orphanedNotes, checkedAt: new Date().toISOString() }
}
