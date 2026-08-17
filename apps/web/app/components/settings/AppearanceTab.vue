<script setup lang="ts">
import { Moon, Sun, RotateCcw } from '@lucide/vue'
import { themeIds } from '@synap/design-tokens'
import { LOCALE_IDS } from '@synap/i18n'
import type { EditorPreferences } from '@synap/store'
import { useI18n } from 'vue-i18n'

const preferences = usePreferencesStore()
const { show } = useToast()
const { t } = useI18n()

const themes = computed(() => [
  { value: 'dark', label: t('settings.themeDark'), icon: Moon },
  { value: 'light', label: t('settings.themeLight'), icon: Sun }
])

const locales = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' }
]

async function setTheme(theme: EditorPreferences['theme']): Promise<void> {
  try {
    await preferences.update({ theme })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}

async function setAccentColor(event: Event): Promise<void> {
  const color = (event.target as HTMLInputElement).value
  try {
    await preferences.update({ accentColor: color })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}

async function resetAccentColor(): Promise<void> {
  try {
    await preferences.update({ accentColor: null })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}

async function setLocale(event: Event): Promise<void> {
  const locale = (event.target as HTMLSelectElement).value as EditorPreferences['locale']
  try {
    await preferences.update({ locale })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}

// Fallback logic for input display value
const displayAccentColor = computed(() => {
  return preferences.preferences.accentColor || '#F5A623' // default hex from token
})
</script>

<template>
  <div class="space-y-8">
    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
        {{ t('settings.appearance') }}
      </h2>
      <div class="inline-flex w-full items-center gap-0.5 rounded-full border border-border p-0.5 md:w-auto md:p-1">
        <button
          v-for="theme in themes"
          :key="theme.value"
          type="button"
          :aria-pressed="preferences.preferences.theme === theme.value"
          class="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-base transition-colors duration-150 md:min-h-0 md:flex-none"
          :class="preferences.preferences.theme === theme.value ? 'bg-surface-2 text-content-primary' : 'text-content-tertiary hover:text-content-secondary'"
          @click="setTheme(theme.value)"
        >
          <component :is="theme.icon" class="h-5 w-5" stroke-width="1.5" />
          {{ theme.label }}
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
        {{ t('settings.accentColor') }}
      </h2>
      <div class="flex items-center gap-3 rounded-lg bg-surface-1 p-4 md:bg-transparent md:p-0">
        <input
          type="color"
          :value="displayAccentColor"
          class="h-10 w-20 cursor-pointer rounded border border-border bg-base p-1"
          @change="setAccentColor"
        >
        <button
          v-if="preferences.preferences.accentColor"
          type="button"
          class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-content-tertiary hover:bg-white/[0.04] hover:text-content-primary transition-colors"
          @click="resetAccentColor"
        >
          <RotateCcw class="h-4 w-4" />
          {{ t('settings.resetAccentColor') }}
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
        {{ t('settings.language') }}
      </h2>
      <div class="flex items-center gap-3 rounded-lg bg-surface-1 p-4 md:bg-transparent md:p-0">
        <select
          class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-base text-content-primary outline-none focus-visible:ring-1 focus-visible:ring-accent/50 md:min-h-0 md:w-auto md:text-sm"
          :value="preferences.preferences.locale"
          @change="setLocale"
        >
          <option
            v-for="locale in locales"
            :key="locale.value"
            :value="locale.value"
          >
            {{ locale.label }}
          </option>
        </select>
      </div>
    </section>
  </div>
</template>
