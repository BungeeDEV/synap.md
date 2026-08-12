interface SearchRow {
  path: string
  title: string
  snippet: string
}

export default defineEventHandler((event) => {
  const { q } = getQuery(event)

  if (typeof q !== 'string' || q.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Query parameter "q" is required' })
  }

  const db = getDb()

  try {
    return db.prepare(`
      SELECT n.path as path, n.title as title,
             snippet(notes_fts, 1, '<mark>', '</mark>', '…', 12) as snippet
      FROM notes_fts
      JOIN notes n ON n.id = notes_fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `).all(q) as SearchRow[]
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid search query' })
  }
})
