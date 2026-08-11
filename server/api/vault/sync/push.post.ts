import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ files?: { path: string; content: string; expectedMtime?: number }[] }>(event)
  if (!body || !Array.isArray(body.files)) {
    throw createError({ statusCode: 400, statusMessage: '"files" must be an array' })
  }

  const config = useRuntimeConfig(event)
  const db = getDb()
  
  const successes: { path: string; mtime: number; hash: string }[] = []
  const conflicts: { path: string; currentContent: string; currentMtime: number }[] = []
  const errors: { path: string; error: string }[] = []

  for (const file of body.files) {
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      errors.push({ path: String(file.path), error: 'Invalid file object' })
      continue
    }

    try {
      let isoMtime: string | undefined
      if (typeof file.expectedMtime === 'number') {
        isoMtime = new Date(file.expectedMtime).toISOString()
      }
      
      const res = await writeVaultFile(db, config.vaultPath, file.path, file.content, isoMtime)
      successes.push({ path: res.path, mtime: new Date(res.mtime).getTime(), hash: res.hash })
    } catch (err: any) {
      if (err && typeof err === 'object' && err.statusCode === 409 && err.data) {
        conflicts.push({
          path: file.path,
          currentContent: err.data.currentContent,
          currentMtime: new Date(err.data.currentMtime).getTime()
        })
      } else if (err && typeof err === 'object' && err.statusCode === 400 && err.statusMessage === 'Invalid file name') {
        errors.push({ path: file.path, error: 'Invalid file name' })
      } else if (err && typeof err === 'object' && err.statusCode === 400 && err.statusMessage === 'Invalid path') {
        errors.push({ path: file.path, error: 'Invalid path' })
      } else {
        errors.push({ path: file.path, error: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  return { successes, conflicts, errors }
})
