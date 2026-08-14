
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

  db.prepare('DELETE FROM share_links WHERE note_id = ?').run(note.id)

  return { success: true }
})
