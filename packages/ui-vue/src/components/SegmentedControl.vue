<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

defineProps<{
  modelValue: T
  options: { value: T, label: string, icon?: Component }[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="inline-flex w-full items-center gap-0.5 rounded-lg border border-border bg-base p-1 md:w-auto">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="modelValue === option.value"
      class="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-base transition-colors duration-150 md:min-h-0 md:flex-none md:text-sm"
      :class="modelValue === option.value ? 'bg-surface-2 text-content-primary shadow-sm' : 'text-content-tertiary hover:text-content-primary'"
      @click="emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" class="h-5 w-5" stroke-width="1.5" />
      {{ option.label }}
    </button>
  </div>
</template>
