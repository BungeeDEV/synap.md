import { rm, stat } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  const { path: relativePath } = getQuery(event)

  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Query parameter "path" is required' })
  }

  const config = useRuntimeConfig(event)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(relativePath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    const stats = await stat(absolutePath)
    if (!stats.isDirectory()) {
      throw createError({ statusCode: 400, statusMessage: 'Path is not a directory' })
    }

    // Recursively delete the folder and its contents from disk
    await rm(absolutePath, { recursive: true, force: true })

    // Clean up the index: remove any indexed notes that were inside this folder.
    // The LIKE clause matches any path that starts with `relativePath/`.
    const db = getDb()
    const matchPattern = `${relativePath}/%`
    const notesToDelete = db.prepare('SELECT path FROM notes WHERE path LIKE ?').all(matchPattern) as { path: string }[]
    
    for (const note of notesToDelete) {
      removeNoteFromIndex(db, note.path)
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete folder' })
  }

  return { path: relativePath, deleted: true }
})
