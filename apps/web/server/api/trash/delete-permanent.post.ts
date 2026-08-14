import { unlink } from 'node:fs/promises'

interface DeletePermanentBody {
  id: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DeletePermanentBody>(event)

  if (typeof body?.id !== 'number') {
    throw createError({ statusCode: 400, statusMessage: '"id" is required' })
  }

  const config = useRuntimeConfig(event)
  const db = getDb()

  const row = db.prepare('SELECT id, trashed_path FROM trash WHERE id = ?').get(body.id) as
    { id: number, trashed_path: string } | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Trash entry not found' })
  }

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(row.trashed_path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    await unlink(absolutePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw createError({ statusCode: 500, statusMessage: 'Failed to delete file' })
    }
  }

  db.prepare('DELETE FROM trash WHERE id = ?').run(row.id)

  return { id: row.id, deleted: true }
})
