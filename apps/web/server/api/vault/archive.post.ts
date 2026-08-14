import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

interface ArchivePostBody {
  path: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ArchivePostBody>(event)

  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }

  const config = useRuntimeConfig(event)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(body.path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    const stats = await stat(absolutePath)
    if (!stats.isFile()) {
      throw createError({ statusCode: 400, statusMessage: 'Path is not a file' })
    }

    // Move into _archive/ rather than unlinking or trashing - archiving is
    // meant to be a "hide from the tree, keep forever" action, distinct from
    // the retention-limited _trash/ soft-delete.
    const archivedRelativePath = await buildArchivedPath(body.path, config.vaultPath)
    const archivedAbsolutePath = resolveVaultPath(archivedRelativePath, config.vaultPath)

    await mkdir(dirname(archivedAbsolutePath), { recursive: true })
    await rename(absolutePath, archivedAbsolutePath)

    getDb().prepare(`
      INSERT INTO archive (original_path, archived_path, archived_at) VALUES (?, ?, ?)
    `).run(body.path, archivedRelativePath, Date.now())

    if (body.path.toLowerCase().endsWith('.md')) {
      removeNoteFromIndex(getDb(), body.path)
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to archive file' })
  }

  return { path: body.path, archived: true }
})
