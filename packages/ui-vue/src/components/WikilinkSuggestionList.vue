<script setup lang="ts">
import { CornerDownLeft, FileText } from '@lucide/vue'
import type { FileEntry } from '@synap/editor-core'
import { ref, watch } from 'vue'

// Same VueRenderer-mounted popup pattern as SlashCommandMenu.vue - see
// wikilinkExtension.ts's `render()` callbacks.
const props = defineProps<{ items: FileEntry[] }>()
const emit = defineEmits<{ select: [file: FileEntry] }>()

const selectedIndex = ref(0)

watch(() => props.items, () => { selectedIndex.value = 0 })

function select(index: number): void {
  const file = props.items[index]
  if (file) emit('select', file)
}

function onKeyDown({ event }: { event: KeyboardEvent }): boolean {
  const count = props.items.length
  if (event.key === 'ArrowDown') {
    selectedIndex.value = count ? (selectedIndex.value + 1) % count : 0
    return true
  }
  if (event.key === 'ArrowUp') {
    selectedIndex.value = count ? (selectedIndex.value - 1 + count) % count : 0
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    select(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div class="absolute z-50 min-w-56 origin-top-left rounded-xl border border-border-strong bg-surface-1 py-1 text-base text-content-primary shadow-float">
    <ul v-if="items.length">
      <li v-for="(file, index) in items" :key="file.path">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150"
          :class="index === selectedIndex ? 'bg-accent text-white' : 'hover:bg-white/[0.04]'"
          @click="select(index)"
          @mouseenter="selectedIndex = index"
        >
          <FileText class="h-5 w-5 shrink-0" :class="index === selectedIndex ? 'text-white' : 'text-content-tertiary'" stroke-width="1.5" />
          <span class="flex-1 truncate">{{ file.title }}</span>
          <CornerDownLeft v-if="index === selectedIndex" class="h-3.5 w-3.5 shrink-0 text-white/70" stroke-width="1.5" />
        </button>
      </li>
    </ul>
    <p v-else class="px-3.5 py-2 text-content-tertiary">
      Keine Treffer
    </p>
  </div>
</template>
