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
    // Folder renames land here too (fs.rename works on directories). Only
    // single-file index bookkeeping is done in this phase - descendant notes
    // inside a renamed folder keep their old (now-broken) path in the index
    // until the next /api/admin/reindex. Acceptable per decisions.md: the
    // index is a rebuildable cache, never the source of truth.
    const wasMarkdown = body.oldPath.toLowerCase().endsWith('.md')
    const isMarkdown = body.newPath.toLowerCase().endsWith('.md')

    if (wasMarkdown && isMarkdown) {
      const db = getDb()
      const before = db.prepare('SELECT id, title FROM notes WHERE path = ?').get(body.oldPath) as { id: number, title: string } | undefined

      await renameNoteInIndex(db, body.oldPath, body.newPath, config.vaultPath)

      if (before) {
        const after = db.prepare('SELECT title FROM notes WHERE id = ?').get(before.id) as { title: string }
        updatedBacklinks = await propagateWikilinkRename(db, before.id, before.title, after.title, config.vaultPath)
      }
    } else if (wasMarkdown) {
      removeNoteFromIndex(getDb(), body.oldPath)
    } else if (isMarkdown) {
      await indexNote(getDb(), body.newPath, config.vaultPath)
    }

    const { mtime } = await stat(newAbsolutePath)
    return { path: body.newPath, mtime: mtime.toISOString(), updatedBacklinks }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('rename.post.ts: renamed on disk but failed to update index for', body.newPath, err)
    throw createError({ statusCode: 500, statusMessage: 'Renamed on disk but failed to update index' })
  }
})
