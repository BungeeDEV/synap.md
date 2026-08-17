<script setup lang="ts">
useGlobalHotkeys()

// Preferences require a session, so /login and /setup (which app.vue also
// wraps, via NuxtPage) must not trigger the fetch - loggedIn flips true
// right after login.vue's refreshSession(), which this watcher picks up
// without needing app.vue itself to remount.
const { loggedIn } = useUserSession()
const preferences = usePreferencesStore()

import { useI18n } from 'vue-i18n'

// import.meta.client guard: this runs during SSR too (top-level watch with
// immediate:true in <script setup>), where an internal $fetch wouldn't carry
// the incoming request's session cookie and would 401 pointlessly - see
// decisions.md. Preferences are only read client-side (tab open, editor
// mount) anyway, so there's nothing SSR needs this for.
watch(loggedIn, (isLoggedIn) => {
  if (isLoggedIn && import.meta.client) void preferences.load()
}, { immediate: true })

const { locale } = useI18n()
watch(() => preferences.preferences.locale, (newLocale) => {
  if (newLocale) locale.value = newLocale
}, { immediate: true })

watch(() => [preferences.preferences.theme, preferences.preferences.accentColor, preferences.loaded], async () => {
  if (!import.meta.client) return
  // Until the real fetch resolves, preferences.preferences just holds
  // DEFAULT_PREFERENCES (theme: 'dark', accentColor: null) - applying that
  // here on this watch's own immediate first run would stomp the correct
  // guess nuxt.config.ts's pre-hydration inline script already applied from
  // the synap:theme localStorage cache, trading one flash for two. Leave
  // the DOM alone until preferences.loaded is actually true.
  if (!preferences.loaded) return

  const theme = preferences.preferences.theme
  const accentColor = preferences.preferences.accentColor

  document.documentElement.dataset.theme = theme || 'dark'

  if (accentColor) {
    document.documentElement.style.setProperty('--color-accent', accentColor)
    const { computeAccentVariations } = await import('@synap/design-tokens')
    const vars = computeAccentVariations(accentColor)
    if (vars) {
      document.documentElement.style.setProperty('--color-accent-soft', vars.soft)
      document.documentElement.style.setProperty('--color-accent-strong', vars.strong)
    }
  } else {
    document.documentElement.style.removeProperty('--color-accent')
    document.documentElement.style.removeProperty('--color-accent-soft')
    document.documentElement.style.removeProperty('--color-accent-strong')
  }

  // Persist for nuxt.config.ts's pre-hydration script to apply synchronously
  // on the next load, before this watch (or even preferences.load()) can run.
  try {
    localStorage.setItem('synap:theme', JSON.stringify({ theme, accentColor }))
  } catch {
    // Private-browsing/storage-disabled edge case - the FOUC guess just
    // won't be available next load, nothing else depends on this.
  }
}, { immediate: true })

// Best-effort backstop for what onBeforeUnmount can't cover: closing the
// browser tab/window (or reloading) entirely, not just switching tabs
// inside the app. beforeunload can't await a promise, so this fires the
// requests and lets the browser's keepalive fetch carry them past
// navigation instead of blocking the unload with a synchronous dialog.
if (import.meta.client) {
  const tabsStore = useTabsStore()
  window.addEventListener('beforeunload', () => {
    for (const tab of tabsStore.tabs) {
      if (!tab.dirty) continue
      void fetch('/api/vault/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ path: tab.path, content: tab.content, lastKnownMtime: tab.lastKnownMtime })
      })
    }
  })
}
</script>

<template>
  <div class="h-app flex flex-col overflow-hidden bg-base font-sans text-content-primary">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ToastContainer />
    <ImportProgressPanel />
  </div>
</template>
