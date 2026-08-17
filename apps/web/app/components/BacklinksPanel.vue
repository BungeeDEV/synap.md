<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Backlink {
  path: string
  title: string
}

const props = defineProps<{ path: string }>()
const { t } = useI18n()

const tabs = useTabsStore()
const backlinks = ref<Backlink[]>([])
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    backlinks.value = await $fetch<Backlink[]>('/api/vault/backlinks', { query: { path: props.path } })
  } finally {
    loading.value = false
  }
}

watch(() => props.path, load, { immediate: true })

function open(path: string): void {
  void tabs.openTab(path)
}
</script>

<template>
  <div v-if="!loading && backlinks.length" class="max-h-32 shrink-0 overflow-y-auto overscroll-contain border-t border-border px-4 py-2">
    <p class="mb-1.5 text-sm font-medium tracking-wider text-content-tertiary uppercase">
      {{ t('actions.mentionedIn') }}
    </p>
    <ul class="flex flex-wrap gap-2">
      <li v-for="link in backlinks" :key="link.path">
        <button
          type="button"
          class="touch-manipulation rounded-full bg-surface-2 px-3.5 py-1.5 text-base text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary"
          @click="open(link.path)"
        >
          {{ link.title }}
        </button>
      </li>
    </ul>
  </div>
</template>
