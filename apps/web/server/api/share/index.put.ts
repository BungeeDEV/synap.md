import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { path, customId, password, maxViews, expiresAt, requireLogin } = body

  if (typeof path !== 'string' || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Path is required' })
  }

  const db = getDb()
  const note = db.prepare('SELECT id FROM notes WHERE path = ?').get(path) as { id: number } | undefined

  if (!note) {
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })
  }

  let finalId = customId
  if (!finalId) {
    // Generate an ID if not provided. Or use the existing one if we are just updating.
    const existing = db.prepare('SELECT id FROM share_links WHERE note_id = ?').get(note.id) as { id: string } | undefined
    finalId = existing ? existing.id : randomUUID()
  } else {
    // Ensure the custom ID is not already used by another note
    const existingForId = db.prepare('SELECT note_id FROM share_links WHERE id = ?').get(finalId) as { note_id: number } | undefined
    if (existingForId && existingForId.note_id !== note.id) {
      throw createError({ statusCode: 400, statusMessage: 'Link ID already in use' })
    }
  }

  let pwdHash = null
  if (password) {
    pwdHash = await hashPassword(password)
  }

  const existing = db.prepare('SELECT password_hash FROM share_links WHERE note_id = ?').get(note.id) as { password_hash: string | null } | undefined
  if (!password && password !== '' && existing) {
    // keep existing password if password field is undefined, but clear if it's empty string
    pwdHash = existing.password_hash
  }

  db.prepare(`
    INSERT INTO share_links (id, note_id, password_hash, max_views, current_views, expires_at, require_login, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      note_id = excluded.note_id,
      password_hash = excluded.password_hash,
      max_views = excluded.max_views,
      expires_at = excluded.expires_at,
      require_login = excluded.require_login
  `).run(
    finalId,
    note.id,
    pwdHash,
    maxViews || null,
    expiresAt || null,
    requireLogin ? 1 : 0,
    Date.now()
  )

  // If the id changed but note_id is the same, we might need to delete the old one, but id is primary key and we insert on conflict id.
  // Wait, if the user changes the custom ID, the ON CONFLICT(id) will insert a NEW row for the same note_id!
  // To fix this, we should just delete any existing row for this note_id first, then insert.
  db.transaction(() => {
    db.prepare('DELETE FROM share_links WHERE note_id = ? AND id != ?').run(note.id, finalId)
  })()

  return { id: finalId }
})
