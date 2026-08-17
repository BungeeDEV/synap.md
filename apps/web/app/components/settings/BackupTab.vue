<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { Download, Loader2 } from '@lucide/vue'

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
    show(t('tree.exportFailed'), 'error')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">{{ t('settings.backupTitle') }}</h2>
    <p class="mb-4 text-sm text-content-secondary">{{ t('settings.backupDesc') }}</p>
    <button
      type="button"
      :disabled="exporting"
      class="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:w-auto md:justify-start"
      @click="exportVault"
    >
      <Loader2 v-if="exporting" class="h-5 w-5 animate-spin" stroke-width="1.5" />
      <Download v-else class="h-5 w-5" stroke-width="1.5" />
      {{ exporting ? t('settings.exporting') : t('settings.exportVault') }}
    </button>

    <!-- The export endpoint builds the whole zip server-side before returning
         a blob, so real byte/file progress isn't available without a server
         change - this indeterminate bar signals "still running", not a
         percentage, so a large vault's export doesn't read as frozen. -->
    <div v-if="exporting" class="mt-3 h-1 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
      <div class="h-full w-1/3 animate-indeterminate-progress rounded-full bg-accent" />
    </div>
  </div>
</template>
