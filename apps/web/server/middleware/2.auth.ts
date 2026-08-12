// Numeric prefix guarantees 1.setup-check.ts runs first: while no user
// exists yet, every request must go to /setup regardless of session state.
import { createHash } from 'node:crypto'
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // /api/admin/* (reindex) isn't in the original spec's protected list, but
  // leaving an unauthenticated trigger for a full vault reindex reachable
  // would be inconsistent with everything else in this app - protecting it
  // alongside vault/search here. /api/settings/*, /api/trash/* (Phase 5),
  // /api/templates/* (Phase 6) and /api/archive/* join the same list for the
  // same reason. /api/auth/* stays unprotected as a whole (setup/login/logout
  // must be reachable pre-session) except the two account-mutation routes,
  // which require an existing session.
  const isProtected = path.startsWith('/api/vault/')
    || path.startsWith('/api/search')
    || path.startsWith('/api/admin/')
    || path.startsWith('/api/settings/')
    || path.startsWith('/api/trash/')
    || path.startsWith('/api/templates/')
    || path.startsWith('/api/archive/')
    || path.startsWith('/api/share/')
    || path === '/api/auth/change-password'
    || path === '/api/auth/change-username'

  if (!isProtected) return

  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    const match = token.match(/^synap_v1_(\d+)_(.+)$/)
    if (match) {
      const id = parseInt(match[1]!, 10)
      const secret = match[2]!
      
      const db = getDb()
      const validToken = db.prepare('SELECT id, token_hash FROM api_tokens WHERE id = ?').get(id) as { id: number, token_hash: string } | undefined
      
      if (validToken && await verifyUserPassword(secret, validToken.token_hash)) {
        db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), validToken.id)
        
        const userRow = db.prepare('SELECT id, username, created_at FROM users LIMIT 1').get() as any
        if (userRow) {
          // Mock the session context so subsequent calls to requireUserSession/getUserSession
          // (if any) succeed without needing a real cookie. nuxt-auth-utils respects this cache.
          event.context.session = {
            user: {
              id: userRow.id,
              username: userRow.username,
              createdAt: userRow.created_at
            }
          }
          return
        }
      }
    }
    
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired API token' })
  }

  await requireUserSession(event)
})
