<script setup lang="ts">
useMobileSplitViewGuard()

// Preferences require a session, so /login and /setup (which app.vue also
// wraps, via NuxtPage) must not trigger the fetch - loggedIn flips true
// right after login.vue's refreshSession(), which this watcher picks up
// without needing app.vue itself to remount.
const { loggedIn } = useUserSession()
const preferences = usePreferencesStore()

watch(loggedIn, (isLoggedIn) => {
  if (isLoggedIn) void preferences.load()
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-base font-sans text-content-primary">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ToastContainer />
  </div>
</template>
