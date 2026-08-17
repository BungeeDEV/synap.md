<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { formatBytes } from '~/utils/formatBytes'

interface VaultStats {
  noteCount: number
  folderCount: number
  attachmentCount: number
  attachmentSizeBytes: number
  totalSizeBytes: number
}

const stats = ref<VaultStats | null>(null)
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true
  try {
    stats.value = await $fetch<VaultStats>('/api/settings/vault-stats')
  } finally {
    loading.value = false
  }
}

void load()
</script>

<template>
  <div class="space-y-8">
    <h2 class="border-b border-border pb-2 text-xl font-semibold">{{ t('settings.vaultStatsTitle') }}</h2>

    <SkeletonList v-if="loading" :rows="5" variant="stats" />

    <div v-else-if="stats" class="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ stats.noteCount }}
        </p>
        <p class="text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.statNotes') }}</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ stats.folderCount }}
        </p>
        <p class="text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.statFolders') }}</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ stats.attachmentCount }}
        </p>
        <p class="text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.statAttachments') }}</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ formatBytes(stats.attachmentSizeBytes) }}
        </p>
        <p class="text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.statAttachmentsSize') }}</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ formatBytes(stats.totalSizeBytes) }}
        </p>
        <p class="text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.statTotalSize') }}</p>
      </div>
    </div>
  </div>
</template>
