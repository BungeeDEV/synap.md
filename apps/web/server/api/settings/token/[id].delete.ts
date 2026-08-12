export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  
  const db = getDb()
  db.prepare('DELETE FROM api_tokens WHERE id = ?').run(id)
  return { success: true }
})
