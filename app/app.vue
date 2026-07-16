<script setup lang="ts">
useMobileSplitViewGuard()

// Preferences require a session, so /login and /setup (which app.vue also
// wraps, via NuxtPage) must not trigger the fetch - loggedIn flips true
// right after login.vue's refreshSession(), which this watcher picks up
// without needing app.vue itself to remount.
const { loggedIn } = useUserSession()
const preferences = usePreferencesStore()

// import.meta.client guard: this runs during SSR too (top-level watch with
// immediate:true in <script setup>), where an internal $fetch wouldn't carry
// the incoming request's session cookie and would 401 pointlessly - see
// decisions.md. Preferences are only read client-side (tab open, editor
// mount) anyway, so there's nothing SSR needs this for.
watch(loggedIn, (isLoggedIn) => {
  if (isLoggedIn && import.meta.client) void preferences.load()
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-base font-sans text-content-primary">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ToastContainer />
  </div>
</template>
