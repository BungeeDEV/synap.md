<script setup lang="ts">
/** Shared pulsing placeholder for lists/grids waiting on their first fetch - reused across the vault tree and the settings list/stat panels instead of a plain "Lädt…" text so first-load feels equally finished everywhere. */
withDefaults(defineProps<{
  /** Number of placeholder rows/cells to render. */
  rows?: number
  /** 'rows': icon + label list row (vault tree, trash/archive/templates). 'stats': number-over-label stat cell (vault stats grid). */
  variant?: 'rows' | 'stats'
}>(), {
  rows: 5,
  variant: 'rows'
})
</script>

<template>
  <div v-if="variant === 'rows'" class="space-y-1 p-1">
    <div v-for="i in rows" :key="i" class="flex items-center gap-2 px-1.5 py-2">
      <div class="h-5 w-5 shrink-0 animate-pulse rounded bg-white/5" />
      <div class="h-4 animate-pulse rounded bg-white/5" :class="i % 3 === 0 ? 'w-20' : i % 2 === 0 ? 'w-32' : 'w-24'" />
    </div>
  </div>

  <div v-else class="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
    <div v-for="i in rows" :key="i">
      <div class="h-7 w-12 animate-pulse rounded bg-white/5" />
      <div class="mt-2 h-3 w-20 animate-pulse rounded bg-white/5" />
    </div>
  </div>
</template>
