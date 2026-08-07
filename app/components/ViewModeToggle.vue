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

const activeIndex = computed(() => modes.findIndex((mode) => mode.value === modelValue.value))
</script>

<template>
  <div class="relative inline-flex touch-manipulation select-none items-center rounded-full border border-border bg-surface-1 p-0.5">
    <div
      class="absolute left-0.5 top-0.5 h-11 w-11 rounded-full bg-accent transition-transform duration-200 ease-out md:h-9 md:w-9"
      :style="{ transform: `translateX(${activeIndex * 100}%)` }"
    />
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      :title="mode.label"
      :aria-label="mode.label"
      :aria-pressed="modelValue === mode.value"
      class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out active:scale-90 md:h-9 md:w-9"
      :class="modelValue === mode.value ? 'text-white' : 'text-content-tertiary hover:text-content-secondary'"
      @click="modelValue = mode.value"
    >
      <component :is="mode.icon" class="h-5 w-5" stroke-width="1.5" />
    </button>
  </div>
</template>
