interface ChangePasswordBody {
  currentPassword: string
  newPassword: string
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody<ChangePasswordBody>(event)

  if (typeof body?.currentPassword !== 'string' || body.currentPassword.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Aktuelles Passwort ist erforderlich' })
  }
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Neues Passwort muss mindestens 8 Zeichen lang sein' })
  }

  const db = getDb()
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string } | undefined
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet' })
  }

  const valid = await verifyUserPassword(body.currentPassword, row.password_hash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Aktuelles Passwort ist falsch' })
  }

  const newHash = await hashUserPassword(body.newPassword)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id)

  return { changed: true }
})
