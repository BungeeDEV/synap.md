interface LoginBody {
  username: string
  password: string
  rememberMe?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)

  if (typeof body?.username !== 'string' || typeof body.password !== 'string') {
    throw createError({ statusCode: 401, statusMessage: 'Zugangsdaten ungültig' })
  }

  const db = getDb()
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(body.username.trim()) as { id: number, username: string, password_hash: string } | undefined

  // Always run a full scrypt verification, even for an unknown username
  // (against a fixed dummy hash), so response timing can't be used to
  // enumerate valid usernames.
  const valid = await verifyUserPassword(body.password, user?.password_hash ?? await getDummyHash())

  if (!user || !valid) {
    throw createError({ statusCode: 401, statusMessage: 'Zugangsdaten ungültig' })
  }

  const sessionOptions = body.rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}
  await setUserSession(event, { user: { id: user.id, username: user.username } }, sessionOptions)

  return { username: user.username }
})
