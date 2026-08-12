import { stat } from 'node:fs/promises'

interface BacklinkRow {
  path: string
  title: string
}

export default defineEventHandler(async (event) => {
  const { path: relativePath } = getQuery(event)

  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Query parameter "path" is required' })
  }

  const config = useRuntimeConfig(event)
  const db = getDb()

  const target = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath) as { id: number } | undefined
  if (!target) return []

  const rows = db.prepare(`
    SELECT n.path as path, n.title as title
    FROM links l
    JOIN notes n ON n.id = l.source_note_id
    WHERE l.target_note_id = ?
    ORDER BY n.title COLLATE NOCASE
  `).all(target.id) as BacklinkRow[]

  // The DB is only reindexed on app-driven writes/deletes - a source file
  // removed directly on disk (outside the app) leaves a stale `notes` row
  // until the next full reindex, so double-check each still exists.
  const stillExist = await Promise.all(rows.map(async (row) => {
    try {
      await stat(resolveVaultPath(row.path, config.vaultPath))
      return true
    } catch {
      return false
    }
  }))

  return rows.filter((_, i) => stillExist[i])
})
