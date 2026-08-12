import type Database from 'better-sqlite3'
import type { ResolvedWikilink } from './remark-wikilinks'

/**
 * Fuzzy-matches a wikilink's raw target text against the `notes` table (by
 * title, exact path, path + ".md", or path suffix) and resolves it to a
 * vault-relative path. Shared by the indexer and the reader render pipeline
 * via `remarkWikilinks` so resolution can't drift between the two.
 */
export function resolveWikilinkTargetPath(db: Database.Database, target: string): ResolvedWikilink {
  const row = db.prepare(`
    SELECT path FROM notes
    WHERE lower(title) = lower(?)
       OR lower(path) = lower(?)
       OR lower(path) = lower(? || '.md')
       OR lower(path) LIKE lower('%/' || ? || '.md')
    LIMIT 1
  `).get(target, target, target, target) as { path: string } | undefined

  return { path: row?.path ?? null }
}
