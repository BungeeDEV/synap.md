import { readFile, writeFile } from 'node:fs/promises'
import type Database from 'better-sqlite3'
// indexNote/resolveVaultPath are picked up via Nitro's server/utils
// auto-import (this file isn't unit-tested directly, unlike indexer.ts/
// vault-path.ts, which import each other explicitly for Vitest compatibility).

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * After a note has been renamed (its index row already updated), rewrites
 * `[[oldTitle]]` / `[[oldTitle|Alias]]` wikilinks in every note that links
 * to it - found via the stable `target_note_id`, so this works regardless
 * of what the linking note's raw wikilink text says. Only the title portion
 * before a `|` is ever touched; alias text is preserved verbatim.
 *
 * Deliberately title-pattern-only, matching the brief's exact scope: a
 * backlink written by path (`[[folder/note.md]]`) instead of by title isn't
 * rewritten here - same class of staleness as the existing folder-rename
 * gap documented in decisions.md.
 */
export async function propagateWikilinkRename(
  db: Database.Database,
  noteId: number,
  oldTitle: string,
  newTitle: string,
  vaultRoot: string
): Promise<string[]> {
  if (oldTitle === newTitle) return []

  const backlinks = db.prepare(`
    SELECT notes.path AS path FROM links
    JOIN notes ON notes.id = links.source_note_id
    WHERE links.target_note_id = ?
  `).all(noteId) as { path: string }[]

  // Case-insensitive: resolveWikilinkTargetPath resolves titles
  // case-insensitively too, so a differently-cased raw wikilink can still
  // legitimately be pointing at this note.
  const pattern = new RegExp(`\\[\\[${escapeRegExp(oldTitle)}(\\|[^\\]]*)?\\]\\]`, 'gi')

  const updatedPaths: string[] = []

  for (const { path } of backlinks) {
    const absolutePath = resolveVaultPath(path, vaultRoot)
    const raw = await readFile(absolutePath, 'utf-8')
    const updated = raw.replace(pattern, (_full, aliasGroup: string | undefined) => `[[${newTitle}${aliasGroup ?? ''}]]`)
    if (updated === raw) continue

    await writeFile(absolutePath, updated, 'utf-8')
    await indexNote(db, path, vaultRoot)
    updatedPaths.push(path)
  }

  return updatedPaths
}
