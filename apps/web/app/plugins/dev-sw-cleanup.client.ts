/**
 * A service worker registered against this origin by an earlier
 * `pnpm build && pnpm preview` run stays active across later `nuxt dev`
 * sessions and keeps polling /dev-sw.js, which vue-router then logs as
 * "No match found" on every attempt - PWA devOptions are deliberately off
 * in dev (see nuxt.config.ts), so nothing in dev mode should be registering
 * one. Unregister any leftover registration so dev mode stays quiet.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.dev || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) void registration.unregister()
    })
    .catch(() => {})
})
