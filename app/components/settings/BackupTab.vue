<script setup lang="ts">
import { Download } from 'lucide-vue-next'

const { show } = useToast()
const exporting = ref(false)

async function exportVault(): Promise<void> {
  exporting.value = true
  try {
    const blob = await $fetch<Blob>('/api/settings/export', { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vault-export-${new Date().toISOString().slice(0, 10)}.zip`
    link.click()
    URL.revokeObjectURL(url)
  } catch {
    show('Export fehlgeschlagen', 'error')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
      Backup
    </h2>
    <p class="mb-4 text-sm text-content-secondary">
      Lädt den gesamten Vault-Inhalt (alle Notes und Anhänge, ohne Papierkorb) als ZIP-Datei herunter.
    </p>
    <button
      type="button"
      :disabled="exporting"
      class="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      @click="exportVault"
    >
      <Download class="h-5 w-5" stroke-width="1.5" />
      {{ exporting ? 'Exportiert…' : 'Vault exportieren' }}
    </button>
  </div>
</template>
