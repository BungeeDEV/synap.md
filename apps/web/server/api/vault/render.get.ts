import { readFile } from 'node:fs/promises'
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

  let raw: string
  try {
    raw = await readFile(absolutePath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to read file' })
  }

  const { content } = matter(raw)
  const { html, frontmatter } = await renderMarkdown(getDb(), content)
  return { html, frontmatter }
})
