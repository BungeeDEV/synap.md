import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path

  if (typeof path !== 'string' || path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }

  const config = useRuntimeConfig(event)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    const data = await readFile(absolutePath)
    setHeader(event, 'Content-Type', mimeTypeForExtension(extname(path)) ?? 'application/octet-stream')
    return data
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
    }
    console.error('attachment.get.ts: failed to read attachment at', absolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to read attachment' })
  }
})
