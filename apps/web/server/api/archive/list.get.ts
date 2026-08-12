interface ArchiveRow {
  id: number
  original_path: string
  archived_path: string
  archived_at: number
}

export default defineEventHandler(() => {
  const rows = getDb().prepare('SELECT id, original_path, archived_path, archived_at FROM archive ORDER BY archived_at DESC').all() as ArchiveRow[]

  return rows.map((row) => ({
    id: row.id,
    originalPath: row.original_path,
    archivedPath: row.archived_path,
    archivedAt: row.archived_at
  }))
})
