<script setup lang="ts">
const props = defineProps<{ content: string, saving: boolean, conflict: boolean }>()

const wordCount = computed(() => {
  const trimmed = props.content.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
})

const charCount = computed(() => props.content.length)

const statusLabel = computed(() => {
  if (props.conflict) return 'Konflikt'
  if (props.saving) return 'Speichert…'
  return 'Gespeichert'
})

const statusDotClass = computed(() => {
  if (props.conflict) return 'bg-danger'
  if (props.saving) return 'bg-content-tertiary animate-pulse'
  return 'bg-success'
})
</script>

<template>
  <div class="flex h-9 shrink-0 touch-manipulation select-none items-center justify-between border-t border-border bg-surface-1 px-3 text-sm text-content-tertiary">
    <span>{{ wordCount }} Wörter · {{ charCount }} Zeichen</span>
    <span class="flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="statusDotClass" />
      {{ statusLabel }}
    </span>
  </div>
</template>
