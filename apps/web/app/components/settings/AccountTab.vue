<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const { user, fetch: refreshSession } = useUserSession()
const { show } = useToast()

function errorMessageOf(err: unknown, fallback: string): string {
  const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return statusMessage ?? fallback
}

const newUsername = ref(user.value?.username ?? '')
const usernameError = ref('')
const usernameSaving = ref(false)

async function saveUsername(): Promise<void> {
  usernameError.value = ''

  if (newUsername.value.trim().length === 0) {
    usernameError.value = t('settings.usernameEmpty')
    return
  }

  usernameSaving.value = true
  try {
    await $fetch('/api/auth/change-username', { method: 'POST', body: { newUsername: newUsername.value.trim() } })
    await refreshSession()
    show(t('settings.usernameChanged'))
  } catch (err) {
    usernameError.value = errorMessageOf(err, t('settings.usernameChangeFailed'))
  } finally {
    usernameSaving.value = false
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const currentPasswordError = ref('')
const newPasswordError = ref('')
const passwordSaving = ref(false)

async function savePassword(): Promise<void> {
  currentPasswordError.value = ''
  newPasswordError.value = ''

  if (newPassword.value.length < 8) {
    newPasswordError.value = t('settings.passwordMinLength')
    return
  }
  if (newPassword.value !== repeatPassword.value) {
    newPasswordError.value = t('setup.passwordMismatch')
    return
  }

  passwordSaving.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    })
    currentPassword.value = ''
    newPassword.value = ''
    repeatPassword.value = ''
    show(t('settings.passwordChanged'))
  } catch (err) {
    currentPasswordError.value = errorMessageOf(err, t('settings.passwordChangeFailed'))
  } finally {
    passwordSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">{{ t('settings.usernameLabel') }}</h2>
      <form class="flex flex-col gap-4 p-4 md:max-w-sm md:gap-2 md:p-0" @submit.prevent="saveUsername">
        <label class="flex flex-col gap-1 text-sm text-content-secondary">{{ t('settings.usernamePlaceholder') }}<input
            v-model="newUsername"
            type="text"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
          >
        </label>
        <p v-if="usernameError" class="text-sm text-danger">
          {{ usernameError }}
        </p>
        <button
          type="submit"
          :disabled="usernameSaving"
          class="min-h-12 w-full rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:w-auto md:self-start"
        >{{ t('settings.save') }}</button>
      </form>
    </section>

    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">{{ t('settings.changePassword') }}</h2>
      <form class="flex flex-col gap-4 p-4 md:max-w-sm md:gap-2 md:p-0" @submit.prevent="savePassword">
        <label class="flex flex-col gap-1 text-sm text-content-secondary">{{ t('settings.currentPassword') }}<input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
          >
        </label>
        <p v-if="currentPasswordError" class="text-sm text-danger">
          {{ currentPasswordError }}
        </p>

        <label class="flex flex-col gap-1 text-sm text-content-secondary">{{ t('settings.newPassword') }}<input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
          >
        </label>
        <p v-if="newPasswordError" class="text-sm text-danger">
          {{ newPasswordError }}
        </p>

        <label class="flex flex-col gap-1 text-sm text-content-secondary">{{ t('settings.repeatNewPassword') }}<input
            v-model="repeatPassword"
            type="password"
            autocomplete="new-password"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
          >
        </label>

        <button
          type="submit"
          :disabled="passwordSaving"
          class="min-h-12 w-full rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:w-auto md:self-start"
        >{{ t('settings.changePassword') }}</button>
      </form>
    </section>
  </div>
</template>
