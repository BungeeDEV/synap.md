<script setup lang="ts">
import { Code2, Columns2, Eye } from 'lucide-vue-next'
import type { ViewMode } from '~/stores/tabs'

const modelValue = defineModel<ViewMode>({ required: true })

const { isMobile } = useIsMobile()

const allModes: { value: ViewMode, label: string, icon: typeof Eye }[] = [
  { value: 'reader', label: 'Reader', icon: Eye },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'code', label: 'Code', icon: Code2 }
]

// Split-pane editing has no room on a phone-width viewport, so the pill
// simply doesn't offer it there - see useMobileSplitViewGuard for the
// matching reactive downgrade of tabs already sitting in 'split'.
const modes = computed(() => isMobile.value ? allModes.filter((mode) => mode.value !== 'split') : allModes)
</script>

<template>
  <div class="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5">
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      :title="mode.label"
      :aria-label="mode.label"
      :aria-pressed="modelValue === mode.value"
      class="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors duration-150 md:py-1"
      :class="modelValue === mode.value ? 'bg-surface-2 text-content-primary' : 'text-content-tertiary hover:text-content-secondary'"
      @click="modelValue = mode.value"
    >
      <component :is="mode.icon" class="h-4 w-4" stroke-width="1.5" />
      <span v-if="modelValue === mode.value">{{ mode.label }}</span>
    </button>
  </div>
</template>
