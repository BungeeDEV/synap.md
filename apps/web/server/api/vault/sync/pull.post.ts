import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ paths?: string[] }>(event)
  if (!body || !Array.isArray(body.paths)) {
    throw createError({ statusCode: 400, statusMessage: '"paths" must be an array of strings' })
  }

  const config = useRuntimeConfig(event)
  const files: { path: string; content: string; mtime: number; hash: string }[] = []
  const notFound: string[] = []

  for (const p of body.paths) {
    if (typeof p !== 'string') continue
    try {
      const absolutePath = resolveVaultPath(p, config.vaultPath)
      const raw = await readFile(absolutePath, 'utf-8')
      const stats = await stat(absolutePath)
      const hash = createHash('sha256').update(raw).digest('hex')
      
      files.push({
        path: p,
        content: raw,
        mtime: Math.trunc(stats.mtimeMs),
        hash
      })
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err) {
        // e.g. path traversal error from resolveVaultPath
        throw err
      }
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        notFound.push(p)
      } else {
        throw createError({ statusCode: 500, statusMessage: `Failed to read ${p}` })
      }
    }
  }

  return { files, notFound }
})
