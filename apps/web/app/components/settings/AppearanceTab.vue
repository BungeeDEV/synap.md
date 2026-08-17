<script setup lang="ts">
import { Moon, Sun, RotateCcw, Check, ChevronDown } from '@lucide/vue'
import { hexToRgb, themeIds } from '@synap/design-tokens'
import { LOCALE_IDS } from '@synap/i18n'
import type { EditorPreferences } from '@synap/store'
import { SegmentedControl } from '@synap/ui-vue'
import { useI18n } from 'vue-i18n'

const preferences = usePreferencesStore()
const { show } = useToast()
const { t } = useI18n()

const themes = computed(() => [
  { value: 'dark' as const, label: t('settings.themeDark'), icon: Moon },
  { value: 'light' as const, label: t('settings.themeLight'), icon: Sun }
])

const locales = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' }
] as const

async function setTheme(theme: EditorPreferences['theme']): Promise<void> {
  try {
    await preferences.update({ theme })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}

// Tailwind's built-in default palette (not arbitrary values, per
// STYLEGUIDE.md). accentColor stays a free-form hex under the hood - these
// are just quick picks that write one of five known hex values into it.
const accentPresets = computed(() => [
  { hex: '#f97316', label: t('settings.accentOrange'), swatchClass: 'bg-orange-500', ringClass: 'ring-orange-500' },
  { hex: '#3b82f6', label: t('settings.accentBlue'), swatchClass: 'bg-blue-500', ringClass: 'ring-blue-500' },
  { hex: '#10b981', label: t('settings.accentEmerald'), swatchClass: 'bg-emerald-500', ringClass: 'ring-emerald-500' },
  { hex: '#a855f7', label: t('settings.accentPurple'), swatchClass: 'bg-purple-500', ringClass: 'ring-purple-500' },
  { hex: '#f43f5e', label: t('settings.accentRose'), swatchClass: 'bg-rose-500', ringClass: 'ring-rose-500' }
])

const activeAccentHex = computed(() => preferences.preferences.accentColor?.toLowerCase() ?? null)

// A null preference means "use the brand default" (#F5A623, close to the
// Orange preset) - treat that as Orange being selected rather than showing
// no swatch active at all.
function isPresetActive(hex: string): boolean {
  if (activeAccentHex.value === null) return hex === accentPresets.value[0]!.hex
  return activeAccentHex.value === hex
}

const isCustomAccentActive = computed(() => {
  if (activeAccentHex.value === null) return false
  return !accentPresets.value.some((preset) => preset.hex === activeAccentHex.value)
})

async function setAccentPreset(hex: string): Promise<void> {
  try {
    await preferences.update({ accentColor: hex })
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

// Fallback logic for input display value
const displayAccentColor = computed(() => {
  return preferences.preferences.accentColor || '#F5A623' // default hex from token
})

function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const [r, g, b] = rgb
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

const isLanguageMenuOpen = ref(false)
const activeLocaleLabel = computed(() =>
  locales.find((locale) => locale.value === preferences.preferences.locale)?.label ?? locales[0]!.label
)

async function selectLocale(value: EditorPreferences['locale']): Promise<void> {
  isLanguageMenuOpen.value = false
  if (value === preferences.preferences.locale) return
  try {
    await preferences.update({ locale: value })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-xl border border-border bg-surface-1 p-6">
      <h2 class="mb-4 text-sm font-semibold text-content-primary">
        {{ t('settings.appearance') }}
      </h2>
      <SegmentedControl :model-value="preferences.preferences.theme" :options="themes" @update:model-value="setTheme" />
    </section>

    <section class="rounded-xl border border-border bg-surface-1 p-6">
      <h2 class="mb-4 text-sm font-semibold text-content-primary">
        {{ t('settings.accentColor') }}
      </h2>
      <div class="flex flex-wrap items-center gap-3">
        <button
          v-for="preset in accentPresets"
          :key="preset.hex"
          type="button"
          class="relative h-8 w-8 shrink-0 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          :class="[preset.swatchClass, isPresetActive(preset.hex) ? ['ring-2', 'ring-offset-2', 'ring-offset-surface-1', preset.ringClass] : '']"
          :aria-label="preset.label"
          :aria-pressed="isPresetActive(preset.hex)"
          @click="setAccentPreset(preset.hex)"
        >
          <Check v-if="isPresetActive(preset.hex)" class="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" stroke-width="3" />
        </button>

        <div class="relative h-8 w-8 shrink-0">
          <input
            type="color"
            class="accent-swatch-input h-8 w-8 rounded-full transition-transform duration-150 hover:scale-110"
            :class="isCustomAccentActive ? 'ring-2 ring-offset-2 ring-offset-surface-1 ring-content-primary' : ''"
            :value="displayAccentColor"
            :aria-label="t('settings.accentCustom')"
            @change="setAccentColor"
          >
          <Check
            v-if="isCustomAccentActive"
            class="pointer-events-none absolute inset-0 m-auto h-4 w-4 drop-shadow"
            :class="isLightColor(displayAccentColor) ? 'text-black/70' : 'text-white'"
            stroke-width="3"
          />
        </div>

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

    <section class="rounded-xl border border-border bg-surface-1 p-6">
      <h2 class="mb-4 text-sm font-semibold text-content-primary">
        {{ t('settings.language') }}
      </h2>
      <div class="relative inline-block w-full md:w-auto">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-left text-sm text-content-primary transition-colors duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 md:w-64"
          aria-haspopup="listbox"
          :aria-expanded="isLanguageMenuOpen"
          @click="isLanguageMenuOpen = !isLanguageMenuOpen"
        >
          <span>{{ activeLocaleLabel }}</span>
          <ChevronDown
            class="h-4 w-4 shrink-0 text-content-tertiary transition-transform duration-150"
            :class="isLanguageMenuOpen ? 'rotate-180' : ''"
            stroke-width="1.5"
          />
        </button>

        <div v-if="isLanguageMenuOpen" class="fixed inset-0 z-40" @click="isLanguageMenuOpen = false" />

        <Transition
          enter-active-class="transition duration-150 ease-out"
          leave-active-class="transition duration-100 ease-in"
          enter-from-class="scale-95 opacity-0"
          leave-to-class="scale-95 opacity-0"
        >
          <div
            v-if="isLanguageMenuOpen"
            role="listbox"
            class="absolute top-full left-0 z-50 mt-1.5 w-full min-w-full origin-top-left rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float md:w-64"
          >
            <button
              v-for="locale in locales"
              :key="locale.value"
              type="button"
              role="option"
              :aria-selected="preferences.preferences.locale === locale.value"
              class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
              @click="selectLocale(locale.value)"
            >
              <span class="flex-1">{{ locale.label }}</span>
              <Check v-if="preferences.preferences.locale === locale.value" class="h-4 w-4 shrink-0 text-accent" stroke-width="1.5" />
            </button>
          </div>
        </Transition>
      </div>
    </section>
  </div>
</template>
