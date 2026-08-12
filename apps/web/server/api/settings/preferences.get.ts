export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const db = getDb()
  const row = db.prepare('SELECT preferences_json FROM users WHERE id = ?').get(user.id) as { preferences_json: string } | undefined

  return parsePreferences(row?.preferences_json ?? '{}')
})
