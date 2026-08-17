<script setup lang="ts">
import { Loader2 } from '@lucide/vue'

const props = defineProps<{ modelValue: string, error?: string | null, submitting?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string], submit: [], cancel: [] }>()

const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  inputRef.value?.focus()
  inputRef.value?.select()
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}
</script>

<template>
  <div class="min-w-0 flex-1">
    <div class="relative">
      <input
        ref="inputRef"
        :value="props.modelValue"
        type="text"
        :disabled="props.submitting"
        class="w-full rounded bg-surface-2 px-1.5 py-1 pr-6 text-base text-content-primary focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-60"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown="onKeydown"
        @click.stop
      >
      <Loader2
        v-if="props.submitting"
        class="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-content-tertiary"
        stroke-width="2"
      />
    </div>
    <p v-if="props.error" class="mt-0.5 text-sm text-danger">
      {{ props.error }}
    </p>
  </div>
</template>
