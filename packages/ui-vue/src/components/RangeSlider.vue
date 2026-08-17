<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number
  min: number
  max: number
  step?: number
  suffix?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

// Tracks every drag frame (input event) so the thumb, fill and printed
// number stay responsive; modelValue itself only updates on commit (change
// event) so consumers that persist to a store aren't hit on every pixel.
const localValue = ref(props.modelValue)
watch(() => props.modelValue, (value) => { localValue.value = value })

const percent = computed(() => {
  const range = props.max - props.min
  return range <= 0 ? 0 : ((localValue.value - props.min) / range) * 100
})

function onInput(event: Event): void {
  localValue.value = Number((event.target as HTMLInputElement).value)
}

function onChange(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="flex items-center gap-4">
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :value="localValue"
      class="range-slider min-h-12 flex-1 md:min-h-0 md:max-w-64"
      :style="{ '--range-fill': `${percent}%` }"
      @input="onInput"
      @change="onChange"
    >
    <span class="w-14 shrink-0 text-right font-mono text-base text-content-primary md:text-sm">{{ localValue }}{{ suffix }}</span>
  </div>
</template>

<style scoped>
/*
 * The fill percentage is a genuinely runtime value Tailwind can't express
 * as a utility class - handled the same documented way the app's dynamic
 * accent color is (apps/web/STYLEGUIDE.md): a single scoped CSS custom
 * property set via :style, consumed here instead of a raw inline style.
 * Thumb/track sizing mirrors apps/desktop's former .custom-slider.
 */
.range-slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.range-slider:focus {
  outline: none;
}
.range-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(to right, var(--color-accent) var(--range-fill), var(--color-surface-2) var(--range-fill));
}
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  margin-top: -5px;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-accent) 30%, transparent);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.range-slider:hover::-webkit-slider-thumb {
  transform: scale(1.15);
}
.range-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--color-surface-1), 0 0 0 4px var(--color-accent);
}
.range-slider::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: var(--color-surface-2);
}
.range-slider::-moz-range-progress {
  height: 6px;
  border-radius: 9999px;
  background: var(--color-accent);
}
.range-slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-accent) 30%, transparent);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.range-slider:hover::-moz-range-thumb {
  transform: scale(1.15);
}
</style>
