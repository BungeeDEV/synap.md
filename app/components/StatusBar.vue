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

// Brief scale "pop" on the dot right when a save completes (saving -> not
// saving, no conflict) - a quieter alternative to a toast/checkmark for
// something that happens this often, per the "dezenter aufblitzender Punkt"
// ask rather than console-only feedback.
const justSaved = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.saving, (saving, wasSaving) => {
  if (!wasSaving || saving || props.conflict) return
  justSaved.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { justSaved.value = false }, 500)
})

onBeforeUnmount(() => { if (flashTimer) clearTimeout(flashTimer) })
</script>

<template>
  <div class="pointer-events-none fixed bottom-3 right-3 z-30 flex touch-manipulation select-none items-center gap-3 rounded-full border border-border bg-surface-1/95 px-3 py-1.5 text-sm text-content-tertiary shadow-float">
    <span>{{ wordCount }} Wörter · {{ charCount }} Zeichen</span>
    <span class="flex items-center gap-1.5">
      <span
        class="h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300"
        :class="[statusDotClass, justSaved ? 'scale-150' : 'scale-100']"
      />
      {{ statusLabel }}
    </span>
  </div>
</template>
