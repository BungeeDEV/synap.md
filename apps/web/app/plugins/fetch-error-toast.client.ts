/**
 * Overrides the global $fetch (the same instance every component's plain
 * `$fetch(...)` call auto-imports) so a true network failure on any
 * /api/* request - the "offline" case, not a 4xx/5xx business error like the
 * 409 conflict dialog already handles - surfaces as a toast instead of
 * silently rejecting. onRequestError only fires when the request never got
 * a response at all (no network), never for HTTP error status codes.
 */
export default defineNuxtPlugin(() => {
  const { show } = useToast()
  const nuxtApp = useNuxtApp()

  globalThis.$fetch = $fetch.create({
    onRequestError({ request }) {
      const url = typeof request === 'string' ? request : request.url
      if (url.includes('/api/')) {
        show(nuxtApp.$i18n.t('settings.connectionError'), 'error')
      }
    }
  })
})
