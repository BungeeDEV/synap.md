<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const error = ref('')
const submitting = ref(false)
const { t } = useI18n()

const { fetch: refreshSession } = useUserSession()

async function handleSubmit() {
  error.value = ''

  if (password.value !== passwordConfirm.value) {
    error.value = t('setup.passwordMismatch')
    return
  }
  if (password.value.length < 8) {
    error.value = t('setup.passwordTooShort')
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    await refreshSession()
    await navigateTo('/')
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('setup.failed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto overscroll-contain bg-base p-4">
    <form class="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border-strong bg-surface-1 p-6" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight text-content-primary">
          {{ t('setup.title') }}
        </h1>
        <p class="text-sm text-content-secondary">
          {{ t('setup.subtitle') }}
        </p>
      </div>

      <label class="flex flex-col gap-1 text-sm text-content-secondary">
        {{ t('auth.username') }}
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
          class="rounded-md border border-border bg-surface-2 px-3 py-2 text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
      </label>

      <label class="flex flex-col gap-1 text-sm text-content-secondary">
        {{ t('auth.password') }}
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          class="rounded-md border border-border bg-surface-2 px-3 py-2 text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
      </label>

      <label class="flex flex-col gap-1 text-sm text-content-secondary">
        {{ t('setup.confirmPassword') }}
        <input
          v-model="passwordConfirm"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
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
        {{ submitting ? t('setup.creating') : t('setup.createAccount') }}
      </button>
    </form>
  </main>
</template>
