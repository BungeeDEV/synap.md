<script setup lang="ts">
import { Eye, PenLine } from 'lucide-vue-next'
import type { ViewMode } from '~/stores/tabs'

const modelValue = defineModel<ViewMode>({ required: true })

// Just 2 modes now that the Tiptap editor itself is WYSIWYG/live-preview -
// "Quelltext"/"Magic View"/"Split" all collapsed into the one editor mode,
// see the Tiptap-Rewrite plan's view-mode consolidation decision.
const modes: { value: ViewMode, label: string, icon: typeof Eye }[] = [
  { value: 'editor', label: 'Editor', icon: PenLine },
  { value: 'reader', label: 'Vorschau', icon: Eye }
]
</script>

<template>
  <!--
    Floating action group, not a segmented-control pill - no encompassing
    background bar or sliding indicator, per the "dezent, only individual
    hover, no continuous background" ask. Active mode reads via icon color
    alone (text-accent), inactive via the standard tertiary/hover-secondary
    text pair already used everywhere else in the app.
  -->
  <div class="inline-flex touch-manipulation select-none items-center gap-1">
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      :title="mode.label"
      :aria-label="mode.label"
      :aria-pressed="modelValue === mode.value"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-white/[0.04]"
      :class="modelValue === mode.value ? 'text-accent' : 'text-content-tertiary hover:text-content-secondary'"
      @click="modelValue = mode.value"
    >
      <component :is="mode.icon" class="h-4 w-4" stroke-width="1.75" />
    </button>
  </div>
</template>
