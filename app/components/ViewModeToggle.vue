<script setup lang="ts">
import { Code2, Columns2, Eye, Wand2 } from 'lucide-vue-next'
import type { ViewMode } from '~/stores/tabs'

const modelValue = defineModel<ViewMode>({ required: true })

const { isMobile } = useIsMobile()

// Ordered raw -> rendered, mirroring the actual editing spectrum (Obsidian's
// Source/Live Preview/Reading, plus our extra Split) rather than the
// arbitrary order the four modes were added in.
const allModes: { value: ViewMode, label: string, icon: typeof Eye }[] = [
  { value: 'code', label: 'Code', icon: Code2 },
  { value: 'live', label: 'Live', icon: Wand2 },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'reader', label: 'Reader', icon: Eye }
]

// Split-pane editing has no room on a phone-width viewport, so the pill
// simply doesn't offer it there - see useMobileSplitViewGuard for the
// matching reactive downgrade of tabs already sitting in 'split'.
const modes = computed(() => isMobile.value ? allModes.filter((mode) => mode.value !== 'split') : allModes)
const activeIndex = computed(() => modes.value.findIndex((mode) => mode.value === modelValue.value))
</script>

<template>
  <div class="relative inline-flex touch-manipulation select-none items-center rounded-full border border-border bg-surface-1 p-0.5">
    <div
      class="absolute left-0.5 top-0.5 h-11 w-11 rounded-full bg-surface-2 transition-transform duration-200 ease-out md:h-9 md:w-9"
      :style="{ transform: `translateX(${activeIndex * 100}%)` }"
    />
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      :title="mode.label"
      :aria-label="mode.label"
      :aria-pressed="modelValue === mode.value"
      class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 md:h-9 md:w-9"
      :class="modelValue === mode.value ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary'"
      @click="modelValue = mode.value"
    >
      <component :is="mode.icon" class="h-5 w-5" stroke-width="1.5" />
    </button>
  </div>
</template>
