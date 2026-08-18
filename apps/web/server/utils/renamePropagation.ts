import { readFile, writeFile } from 'node:fs/promises'
import type Database from 'better-sqlite3'
import { indexNote } from './indexer'
import { resolveVaultPath } from './vault-path'

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
 * Deliberately title-pattern-only - a backlink written by path
 * (`[[folder/note.md]]`) instead of by title isn't rewritten here, that's
 * `propagatePathWikilinkRename` below.
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

/**
 * Path-literal counterpart to `propagateWikilinkRename` above: after a note
 * has moved from `oldPath` to `newPath` (its index row already updated),
 * rewrites `[[oldPath]]` / `[[oldPath|Alias]]` wikilinks - with or without
 * the trailing `.md` - in every note that links to it. Same
 * `target_note_id` lookup as the title-based rewrite, so it doesn't matter
 * whether the move came from a single-file rename or from a folder
 * rename/move that carried this note along with it.
 *
 * Deliberately does NOT touch a bare-filename wikilink (`[[note]]`, no
 * `/`) that resolved to this note via `resolveWikilinkTargetPath`'s suffix-
 * match fallback (`LIKE '%/' || ? || '.md'`) - that form never references
 * the folder at all, so a folder-only rename can't make it stale; only a
 * *full* path reference can.
 */
export async function propagatePathWikilinkRename(
  db: Database.Database,
  noteId: number,
  oldPath: string,
  newPath: string,
  vaultRoot: string
): Promise<string[]> {
  if (oldPath === newPath) return []

  const oldPathNoExt = oldPath.replace(/\.md$/i, '')
  const newPathNoExt = newPath.replace(/\.md$/i, '')

  const backlinks = db.prepare(`
    SELECT notes.path AS path FROM links
    JOIN notes ON notes.id = links.source_note_id
    WHERE links.target_note_id = ?
  `).all(noteId) as { path: string }[]

  // Case-insensitive, same reasoning as propagateWikilinkRename -
  // resolveWikilinkTargetPath's path branches are case-insensitive too.
  const pattern = new RegExp(
    `\\[\\[(${escapeRegExp(oldPath)}|${escapeRegExp(oldPathNoExt)})(\\|[^\\]]*)?\\]\\]`,
    'gi'
  )

  const updatedPaths: string[] = []

  for (const { path } of backlinks) {
    const absolutePath = resolveVaultPath(path, vaultRoot)
    const raw = await readFile(absolutePath, 'utf-8')
    const updated = raw.replace(pattern, (_full, matchedTarget: string, aliasGroup: string | undefined) => {
      const replacement = matchedTarget.toLowerCase() === oldPath.toLowerCase() ? newPath : newPathNoExt
      return `[[${replacement}${aliasGroup ?? ''}]]`
    })
    if (updated === raw) continue

    await writeFile(absolutePath, updated, 'utf-8')
    await indexNote(db, path, vaultRoot)
    updatedPaths.push(path)
  }

  return updatedPaths
}
