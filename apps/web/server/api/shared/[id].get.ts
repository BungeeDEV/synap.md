import { readFile } from 'node:fs/promises'
import matter from 'gray-matter'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  const db = getDb()
  const share = db.prepare(`
    SELECT s.id, s.note_id, s.password_hash, s.max_views, s.current_views, s.expires_at, s.require_login, n.path, n.title
    FROM share_links s
    JOIN notes n ON s.note_id = n.id
    WHERE s.id = ?
  `).get(id) as any

  if (!share) {
    throw createError({ statusCode: 404, statusMessage: 'Link not found' })
  }

  if (share.require_login) {
    // If not logged in, this throws 401
    await requireUserSession(event)
  }

  if (share.expires_at && Date.now() > share.expires_at) {
    throw createError({ statusCode: 410, statusMessage: 'Link expired' })
  }

  if (share.max_views !== null && share.current_views >= share.max_views) {
    throw createError({ statusCode: 410, statusMessage: 'Max views exceeded' })
  }

  if (share.password_hash) {
    return { requiresPassword: true }
  }

  // Increment views
  db.prepare('UPDATE share_links SET current_views = current_views + 1 WHERE id = ?').run(id)

  const config = useRuntimeConfig(event)
  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(share.path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Note file not found' })
  }

  let raw: string
  try {
    raw = await readFile(absolutePath, 'utf-8')
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Note file not found on disk' })
  }

  const { content } = matter(raw)
  const html = await renderMarkdown(db, content)

  return { html, title: share.title, requiresPassword: false }
})
