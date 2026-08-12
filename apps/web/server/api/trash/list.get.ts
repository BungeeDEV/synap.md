interface TrashRow {
  id: number
  original_path: string
  trashed_path: string
  deleted_at: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const retentionDays = Number.parseInt(config.trashRetentionDays, 10)
  const retentionMs = (Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30) * DAY_MS

  const rows = getDb().prepare('SELECT id, original_path, trashed_path, deleted_at FROM trash ORDER BY deleted_at DESC').all() as TrashRow[]

  return rows.map((row) => ({
    id: row.id,
    originalPath: row.original_path,
    trashedPath: row.trashed_path,
    deletedAt: row.deleted_at,
    daysRemaining: Math.max(0, Math.ceil((row.deleted_at + retentionMs - Date.now()) / DAY_MS))
  }))
})
