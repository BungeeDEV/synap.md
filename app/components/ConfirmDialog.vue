<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}>(), {
  confirmLabel: 'Löschen',
  cancelLabel: 'Abbrechen',
  destructive: true
})

const emit = defineEmits<{ confirm: [], cancel: [] }>()

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="emit('cancel')">
    <div class="w-full max-w-md rounded-xl border border-border-strong bg-surface-1 p-6 text-sm text-content-primary shadow-float" @click.stop>
      <h2 class="mb-2 font-semibold text-content-primary">
        {{ title }}
      </h2>
      <p class="mb-4 text-content-secondary">
        {{ message }}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-border-strong px-3 py-1.5 text-content-primary transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-accent/50"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
          :class="destructive ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent/90'"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
