<script setup lang="ts">
const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

const { fetch: refreshSession } = useUserSession()

async function handleSubmit() {
  error.value = ''
  submitting.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    await refreshSession()
    await navigateTo('/')
  } catch {
    // Deliberately generic - the server never reveals whether the
    // username or the password was wrong, so neither does the client.
    error.value = 'Zugangsdaten ungültig'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto overscroll-contain bg-base p-4">
    <form class="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border-strong bg-surface-1 p-6" @submit.prevent="handleSubmit">
      <h1 class="text-2xl font-semibold tracking-tight text-content-primary">
        synap.md
      </h1>

      <label class="flex flex-col gap-1 text-sm text-content-secondary">
        Username
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
          class="rounded-md border border-border bg-surface-2 px-3 py-2 text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
      </label>

      <label class="flex flex-col gap-1 text-sm text-content-secondary">
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="rounded-md border border-border bg-surface-2 px-3 py-2 text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
      </label>

      <p v-if="error" class="text-sm text-danger">
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="rounded-md bg-accent px-4 py-2 font-medium text-content-primary transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>
