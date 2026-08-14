import { access, mkdir, rename } from 'node:fs/promises'
import { dirname, extname } from 'node:path'

interface RestorePostBody {
  id: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RestorePostBody>(event)

  if (typeof body?.id !== 'number') {
    throw createError({ statusCode: 400, statusMessage: '"id" is required' })
  }

  const config = useRuntimeConfig(event)
  const db = getDb()

  const row = db.prepare('SELECT id, original_path, trashed_path FROM trash WHERE id = ?').get(body.id) as
    { id: number, original_path: string, trashed_path: string } | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Trash entry not found' })
  }

  let trashedAbsolutePath: string
  let targetRelativePath = row.original_path
  let targetAbsolutePath: string
  try {
    trashedAbsolutePath = resolveVaultPath(row.trashed_path, config.vaultPath)
    targetAbsolutePath = resolveVaultPath(targetRelativePath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  let renamed = false
  const targetExists = await access(targetAbsolutePath).then(() => true).catch(() => false)
  if (targetExists) {
    const ext = extname(targetRelativePath)
    const base = targetRelativePath.slice(0, targetRelativePath.length - ext.length)
    targetRelativePath = `${base} (wiederhergestellt)${ext}`
    targetAbsolutePath = resolveVaultPath(targetRelativePath, config.vaultPath)
    renamed = true
  }

  try {
    await mkdir(dirname(targetAbsolutePath), { recursive: true })
    await rename(trashedAbsolutePath, targetAbsolutePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Trashed file not found on disk' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to restore file' })
  }

  db.prepare('DELETE FROM trash WHERE id = ?').run(row.id)

  if (targetRelativePath.toLowerCase().endsWith('.md')) {
    await indexNote(db, targetRelativePath, config.vaultPath)
  }

  return { path: targetRelativePath, renamed }
})
