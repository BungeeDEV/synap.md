// Numeric prefix guarantees this runs before 2.auth.ts regardless of
// alphabetical filename order - the setup redirect must win over the auth
// check while no user exists yet, independent of session state.

// Setup only ever transitions from "not done" to "done" once, never back
// (short of a fresh empty database) - so once we've observed a user exists,
// there's no need to keep re-querying SQLite on every single request for
// the rest of the process's lifetime. Only the "not done yet" state is
// worth re-checking each time, since that's the one that can still change.
let setupComplete = false

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/_nuxt/') || path === '/setup' || path === '/api/auth/setup' || path === '/favicon.ico') {
    return
  }

  if (setupComplete) return

  const db = getDb()
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }

  if (count === 0) {
    await sendRedirect(event, '/setup')
    return
  }

  setupComplete = true
})
