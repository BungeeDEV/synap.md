<script setup lang="ts">
import { ChevronRight, Menu } from 'lucide-vue-next'

const props = defineProps<{ path: string, tocVisible: boolean }>()
const emit = defineEmits<{ 'toggle-toc': [] }>()

// Last segment (filename) rendered without the .md extension - the rest are
// plain folder names as they appear in the vault tree.
const segments = computed(() => {
  const parts = props.path.split('/')
  const file = parts.pop() ?? props.path
  return [...parts, file.replace(/\.md$/i, '')]
})
</script>

<template>
  <div class="flex h-11 shrink-0 touch-manipulation select-none items-center justify-between gap-2 border-b border-border bg-surface-1 px-3">
    <div class="flex min-w-0 items-center gap-1 text-sm text-content-tertiary">
      <template v-for="(segment, index) in segments" :key="index">
        <ChevronRight v-if="index > 0" class="h-3.5 w-3.5 shrink-0" stroke-width="1.5" />
        <span class="truncate" :class="index === segments.length - 1 ? 'text-content-secondary' : ''">{{ segment }}</span>
      </template>
    </div>
    <button
      type="button"
      class="shrink-0 rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-secondary"
      :title="tocVisible ? 'Inhaltsverzeichnis ausblenden' : 'Inhaltsverzeichnis einblenden'"
      @click="emit('toggle-toc')"
    >
      <Menu class="h-4 w-4" stroke-width="1.5" />
    </button>
  </div>
</template>
