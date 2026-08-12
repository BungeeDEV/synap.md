interface ChangeUsernameBody {
  newUsername: string
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody<ChangeUsernameBody>(event)

  if (typeof body?.newUsername !== 'string' || body.newUsername.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Benutzername ist erforderlich' })
  }

  const newUsername = body.newUsername.trim()
  const db = getDb()

  try {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, user.id)
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, statusMessage: 'Benutzername ist bereits vergeben' })
    }
    throw err
  }

  await setUserSession(event, { user: { id: user.id, username: newUsername } })

  return { username: newUsername }
})
