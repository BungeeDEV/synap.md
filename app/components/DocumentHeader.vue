<script setup lang="ts">
import { Star } from 'lucide-vue-next'
import { formatRelativeTime } from '#shared/formatDate'

const props = defineProps<{ path: string, title: string, mtime: string | null }>()

const { isFavorite, toggleFavorite } = useFavorites()

const metaLabel = computed(() => (props.mtime ? `Zuletzt bearbeitet ${formatRelativeTime(new Date(props.mtime))}` : null))
</script>

<template>
  <div class="mx-auto max-w-3xl px-2 pt-2 pb-6">
    <div class="flex items-start gap-2">
      <h1 class="flex-1 text-4xl font-bold tracking-tight text-content-primary md:text-5xl">
        {{ title }}
      </h1>
      <button
        type="button"
        class="mt-1 shrink-0 rounded-md p-1.5 transition-colors duration-150"
        :class="isFavorite(path) ? 'text-accent' : 'text-content-tertiary hover:text-accent'"
        :title="isFavorite(path) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'"
        @click="toggleFavorite(path)"
      >
        <Star class="h-6 w-6" stroke-width="1.5" :fill="isFavorite(path) ? 'currentColor' : 'none'" />
      </button>
    </div>
    <p v-if="metaLabel" class="mt-1 text-sm text-content-tertiary">
      {{ metaLabel }}
    </p>
  </div>
</template>
