// Numeric prefix guarantees this runs before 2.auth.ts regardless of
// alphabetical filename order - the setup redirect must win over the auth
// check while no user exists yet, independent of session state.
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/_nuxt/') || path === '/setup' || path === '/api/auth/setup' || path === '/favicon.ico') {
    return
  }

  const db = getDb()
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }

  if (count === 0) {
    await sendRedirect(event, '/setup')
  }
})
