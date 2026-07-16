<script setup lang="ts">
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}
</script>

<template>
  <div class="space-y-8">
    <h2 class="border-b border-border pb-2 text-xl font-semibold">
      Vault & Speicher
    </h2>

    <p v-if="loading" class="text-sm text-content-tertiary">
      Lädt…
    </p>

    <div v-else-if="stats" class="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ stats.noteCount }}
        </p>
        <p class="text-xs font-medium tracking-wider text-content-tertiary uppercase">
          Notes
        </p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ stats.folderCount }}
        </p>
        <p class="text-xs font-medium tracking-wider text-content-tertiary uppercase">
          Ordner
        </p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ stats.attachmentCount }}
        </p>
        <p class="text-xs font-medium tracking-wider text-content-tertiary uppercase">
          Anhänge
        </p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ formatBytes(stats.attachmentSizeBytes) }}
        </p>
        <p class="text-xs font-medium tracking-wider text-content-tertiary uppercase">
          Anhänge-Größe
        </p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-content-primary">
          {{ formatBytes(stats.totalSizeBytes) }}
        </p>
        <p class="text-xs font-medium tracking-wider text-content-tertiary uppercase">
          Gesamtgröße
        </p>
      </div>
    </div>
  </div>
</template>
