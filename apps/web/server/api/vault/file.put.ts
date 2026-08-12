import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

interface FilePutBody {
  path: string
  content: string
  lastKnownMtime?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<FilePutBody>(event)

  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }
  if (typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '"content" must be a string' })
  }

  const config = useRuntimeConfig(event)
  const db = getDb()

  try {
    const res = await writeVaultFile(db, config.vaultPath, body.path, body.content, body.lastKnownMtime)
    return { path: res.path, mtime: res.mtime }
  } catch (err) {
    throw err
  }
})
