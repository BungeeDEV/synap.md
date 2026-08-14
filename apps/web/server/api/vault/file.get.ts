import { readFile, stat } from 'node:fs/promises'
import matter from 'gray-matter'

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
    const [raw, stats] = await Promise.all([readFile(absolutePath, 'utf-8'), stat(absolutePath)])
    const { data: frontmatter, content } = matter(raw)
    return { content, frontmatter, raw, mtime: stats.mtime.toISOString(), createdAt: stats.birthtime.toISOString() }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to read file' })
  }
})
