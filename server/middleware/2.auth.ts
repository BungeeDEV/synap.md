// Numeric prefix guarantees 1.setup-check.ts runs first: while no user
// exists yet, every request must go to /setup regardless of session state.
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
    || path === '/api/auth/change-password'
    || path === '/api/auth/change-username'

  if (!isProtected) return

  await requireUserSession(event)
})
