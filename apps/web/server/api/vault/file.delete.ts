import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

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
    if (!stats.isFile()) {
      throw createError({ statusCode: 400, statusMessage: 'Path is not a file' })
    }

    // Soft delete: move into _trash/ instead of unlinking, so the file can
    // still be restored - see decisions.md / trash system.
    const trashedRelativePath = await buildTrashedPath(relativePath, config.vaultPath)
    const trashedAbsolutePath = resolveVaultPath(trashedRelativePath, config.vaultPath)

    await mkdir(dirname(trashedAbsolutePath), { recursive: true })
    await rename(absolutePath, trashedAbsolutePath)

    getDb().prepare(`
      INSERT INTO trash (original_path, trashed_path, deleted_at) VALUES (?, ?, ?)
    `).run(relativePath, trashedRelativePath, Date.now())

    if (relativePath.toLowerCase().endsWith('.md')) {
      removeNoteFromIndex(getDb(), relativePath)
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete file' })
  }

  return { path: relativePath, deleted: true }
})
