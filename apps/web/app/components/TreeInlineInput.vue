<script setup lang="ts">
const props = defineProps<{ modelValue: string, error?: string | null }>()
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
    <input
      ref="inputRef"
      :value="props.modelValue"
      type="text"
      class="w-full rounded bg-surface-2 px-1.5 py-1 text-base text-content-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="onKeydown"
      @click.stop
    >
    <p v-if="props.error" class="mt-0.5 text-sm text-danger">
      {{ props.error }}
    </p>
  </div>
</template>
