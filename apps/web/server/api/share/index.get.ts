
interface ShareLinkRow {
  id: string
  note_id: number
  password_hash: string | null
  max_views: number | null
  current_views: number
  expires_at: number | null
  require_login: number
}

export default defineEventHandler((event) => {
  const { path } = getQuery(event)
  if (typeof path !== 'string' || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Path is required' })
  }

  const db = getDb()
  const note = db.prepare('SELECT id FROM notes WHERE path = ?').get(path) as { id: number } | undefined

  if (!note) {
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })
  }

  const share = db.prepare(`
    SELECT id, password_hash, max_views, current_views, expires_at, require_login
    FROM share_links
    WHERE note_id = ?
  `).get(note.id) as ShareLinkRow | undefined

  if (!share) {
    return null
  }

  return {
    id: share.id,
    hasPassword: !!share.password_hash,
    maxViews: share.max_views,
    currentViews: share.current_views,
    expiresAt: share.expires_at,
    requireLogin: Boolean(share.require_login)
  }
})
