import { access, rename, stat } from 'node:fs/promises'

interface RenamePostBody {
  oldPath: string
  newPath: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RenamePostBody>(event)

  if (typeof body?.oldPath !== 'string' || body.oldPath.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"oldPath" is required' })
  }
  if (typeof body.newPath !== 'string' || body.newPath.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"newPath" is required' })
  }

  const config = useRuntimeConfig(event)

  let oldAbsolutePath: string
  let newAbsolutePath: string
  try {
    oldAbsolutePath = resolveVaultPath(body.oldPath, config.vaultPath)
    newAbsolutePath = resolveVaultPath(body.newPath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  const targetExists = await access(newAbsolutePath).then(() => true).catch(() => false)
  if (targetExists) {
    throw createError({ statusCode: 409, statusMessage: 'A file already exists at "newPath"' })
  }

  try {
    await rename(oldAbsolutePath, newAbsolutePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // ENOENT here means either the source is gone, or (recursive mkdir
      // isn't in play for rename) the OS rejected newPath's syntax - tell
      // those apart instead of always blaming a missing source file.
      const oldStillExists = await access(oldAbsolutePath).then(() => true).catch(() => false)
      if (!oldStillExists) {
        throw createError({ statusCode: 404, statusMessage: 'File not found' })
      }
      throw createError({ statusCode: 400, statusMessage: 'Invalid new name' })
    }
    console.error('rename.post.ts: failed to rename', oldAbsolutePath, '->', newAbsolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to rename file' })
  }

  let updatedBacklinks: string[] = []

  try {
    const newStats = await stat(newAbsolutePath)

    if (newStats.isDirectory()) {
      // Folder renames land here too (fs.rename works on directories just as
      // well as files). Every descendant note keeps its filename and content,
      // only its path prefix changes, so a bulk path-prefix rewrite is enough
      // - no per-file reindex, no title-based wikilink propagation needed
      // (title-based wikilinks don't reference path at all). Path-*literal*
      // wikilinks (`[[folder/note.md]]`) DO reference the moved path though,
      // so each renamed descendant still needs propagatePathWikilinkRename.
      const db = getDb()
      const renamedNotes = renameFolderInIndex(db, body.oldPath, body.newPath)

      const backlinkPaths = new Set<string>()
      for (const note of renamedNotes) {
        for (const path of await propagatePathWikilinkRename(db, note.id, note.oldPath, note.newPath, config.vaultPath)) {
          backlinkPaths.add(path)
        }
      }
      updatedBacklinks = [...backlinkPaths]

      // Same staleness class, different table: favorites/expandedFolders/
      // folderColors also store vault-relative paths (preferences.ts).
      const users = db.prepare('SELECT id, preferences_json FROM users').all() as { id: number, preferences_json: string }[]
      const updatePreferences = db.prepare('UPDATE users SET preferences_json = ? WHERE id = ?')
      for (const user of users) {
        const rewritten = rewritePreferencePathsForRename(parsePreferences(user.preferences_json), body.oldPath, body.newPath)
        if (rewritten) updatePreferences.run(JSON.stringify(rewritten), user.id)
      }
    } else {
      const wasMarkdown = body.oldPath.toLowerCase().endsWith('.md')
      const isMarkdown = body.newPath.toLowerCase().endsWith('.md')

      if (wasMarkdown && isMarkdown) {
        const db = getDb()
        const before = db.prepare('SELECT id, title FROM notes WHERE path = ?').get(body.oldPath) as { id: number, title: string } | undefined

        await renameNoteInIndex(db, body.oldPath, body.newPath, config.vaultPath)

        if (before) {
          const after = db.prepare('SELECT title FROM notes WHERE id = ?').get(before.id) as { title: string }
          const backlinkPaths = new Set<string>()
          for (const path of await propagateWikilinkRename(db, before.id, before.title, after.title, config.vaultPath)) {
            backlinkPaths.add(path)
          }
          for (const path of await propagatePathWikilinkRename(db, before.id, body.oldPath, body.newPath, config.vaultPath)) {
            backlinkPaths.add(path)
          }
          updatedBacklinks = [...backlinkPaths]
        }
      } else if (wasMarkdown) {
        removeNoteFromIndex(getDb(), body.oldPath)
      } else if (isMarkdown) {
        await indexNote(getDb(), body.newPath, config.vaultPath)
      }
    }

    return { path: body.newPath, mtime: newStats.mtime.toISOString(), updatedBacklinks }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('rename.post.ts: renamed on disk but failed to update index for', body.newPath, err)
    throw createError({ statusCode: 500, statusMessage: 'Renamed on disk but failed to update index' })
  }
})
