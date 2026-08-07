<script setup lang="ts">
import { Eye, PenLine } from 'lucide-vue-next'
import type { ViewMode } from '~/stores/tabs'

const preferences = usePreferencesStore()
const { show } = useToast()

// Just 2 modes now that the Tiptap editor is WYSIWYG/live-preview itself -
// see ViewModeToggle.vue.
const modes: { value: ViewMode, label: string, icon: typeof Eye }[] = [
  { value: 'editor', label: 'Editor', icon: PenLine },
  { value: 'reader', label: 'Vorschau', icon: Eye }
]

async function setDefaultViewMode(mode: ViewMode): Promise<void> {
  try {
    await preferences.update({ defaultViewMode: mode })
    show('Einstellung gespeichert')
  } catch {
    show('Einstellung konnte nicht gespeichert werden', 'error')
  }
}

async function setFontSize(event: Event): Promise<void> {
  const size = Number((event.target as HTMLInputElement).value)
  try {
    await preferences.update({ editorFontSize: size })
  } catch {
    show('Einstellung konnte nicht gespeichert werden', 'error')
  }
}
</script>

<template>
  <div class="space-y-8">
    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
        Standard-Ansicht für neue Notes
      </h2>
      <div class="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5">
        <button
          v-for="mode in modes"
          :key="mode.value"
          type="button"
          :aria-pressed="preferences.preferences.defaultViewMode === mode.value"
          class="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-base transition-colors duration-150"
          :class="preferences.preferences.defaultViewMode === mode.value ? 'bg-surface-2 text-content-primary' : 'text-content-tertiary hover:text-content-secondary'"
          @click="setDefaultViewMode(mode.value)"
        >
          <component :is="mode.icon" class="h-5 w-5" stroke-width="1.5" />
          {{ mode.label }}
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
        Editor-Schriftgröße
      </h2>
      <div class="flex items-center gap-3">
        <input
          type="range"
          min="10"
          max="24"
          step="1"
          :value="preferences.preferences.editorFontSize"
          class="w-48 accent-accent"
          @change="setFontSize"
        >
        <span class="w-12 font-mono text-sm text-content-primary">{{ preferences.preferences.editorFontSize }}px</span>
      </div>
    </section>
  </div>
</template>
