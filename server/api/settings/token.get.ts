export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const db = getDb()
  const tokens = db.prepare('SELECT id, name, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC').all()
  return { tokens }
})
