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

watch(() => [preferences.preferences.theme, preferences.preferences.accentColor], async () => {
  if (!import.meta.client) return
  
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
}, { immediate: true })
</script>

<template>
  <div class="h-app flex flex-col overflow-hidden bg-base font-sans text-content-primary">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ToastContainer />
    <ImportProgressPanel />
  </div>
</template>
