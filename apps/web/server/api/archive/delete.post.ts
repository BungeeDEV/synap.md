import { mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

interface DeleteBody {
  id: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DeleteBody>(event)

  if (typeof body?.id !== 'number') {
    throw createError({ statusCode: 400, statusMessage: '"id" is required' })
  }

  const config = useRuntimeConfig(event)
  const db = getDb()

  const row = db.prepare('SELECT id, original_path, archived_path FROM archive WHERE id = ?').get(body.id) as
    { id: number, original_path: string, archived_path: string } | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Archive entry not found' })
  }

  // "Delete" from the archive still goes through _trash/ rather than
  // unlinking directly - every destructive path in this app is a soft
  // delete, see decisions.md / trash system.
  const trashedRelativePath = await buildTrashedPath(row.original_path, config.vaultPath)

  let archivedAbsolutePath: string
  let trashedAbsolutePath: string
  try {
    archivedAbsolutePath = resolveVaultPath(row.archived_path, config.vaultPath)
    trashedAbsolutePath = resolveVaultPath(trashedRelativePath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    await mkdir(dirname(trashedAbsolutePath), { recursive: true })
    await rename(archivedAbsolutePath, trashedAbsolutePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Archived file not found on disk' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to move file to trash' })
  }

  db.prepare('DELETE FROM archive WHERE id = ?').run(row.id)
  db.prepare('INSERT INTO trash (original_path, trashed_path, deleted_at) VALUES (?, ?, ?)').run(row.original_path, trashedRelativePath, Date.now())

  return { id: row.id, movedToTrash: true }
})
