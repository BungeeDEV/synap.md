interface SetupBody {
  username: string
  password: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SetupBody>(event)

  if (typeof body?.username !== 'string' || body.username.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Username is required' })
  }
  if (typeof body.password !== 'string' || body.password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  const username = body.username.trim()
  // Hash before the DB check/insert so no `await` sits between them - the
  // check-then-insert below runs as one synchronous, uninterruptible tick,
  // which is what actually makes the re-check race-proof (see below).
  const passwordHash = await hashPassword(body.password)

  const db = getDb()

  const user = db.transaction(() => {
    // Never trust the frontend's idea of "setup isn't done yet" - re-check
    // server-side, immediately before creating the user, so a second admin
    // can't be slipped in after initial setup by racing/replaying this call.
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    if (count > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Setup has already been completed' })
    }

    return db.prepare(`
      INSERT INTO users (username, password_hash, created_at)
      VALUES (?, ?, ?)
      RETURNING id, username
    `).get(username, passwordHash, new Date().toISOString()) as { id: number, username: string }
  })()

  await setUserSession(event, { user: { id: user.id, username: user.username } })

  return { username: user.username }
})
