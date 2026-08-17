<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { Archive, ArchiveRestore, Trash2 } from '@lucide/vue'

interface ArchiveEntry {
  id: number
  originalPath: string
  archivedPath: string
  archivedAt: number
}

const { show } = useToast()

const entries = ref<ArchiveEntry[]>([])
const loading = ref(true)
const pendingDelete = ref<ArchiveEntry | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    entries.value = await $fetch<ArchiveEntry[]>('/api/archive/list')
  } finally {
    loading.value = false
  }
}

void load()

function nameOf(path: string): string {
  return path.split('/').pop() ?? path
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function restore(entry: ArchiveEntry): Promise<void> {
  try {
    const result = await $fetch<{ path: string, renamed: boolean }>('/api/archive/restore', {
      method: 'POST',
      body: { id: entry.id }
    })
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    show(result.renamed
      ? t('settings.restoredAsRenamedToast', { name: nameOf(result.path) })
      : t('settings.restoredToast'))
  } catch {
    show(t('settings.restoreFailed'), 'error')
  }
}

async function confirmDeleteToTrash(): Promise<void> {
  if (!pendingDelete.value) return
  const entry = pendingDelete.value
  pendingDelete.value = null

  try {
    await $fetch('/api/archive/delete', { method: 'POST', body: { id: entry.id } })
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    show(t('settings.movedToTrashToast'))
  } catch {
    show(t('settings.deleteFailed'), 'error')
  }
}
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">{{ t('settings.archiveTitle') }}</h2>

    <p v-if="loading" class="text-sm text-content-tertiary">
      Lädt…
    </p>

    <div v-else-if="entries.length === 0" class="flex flex-col items-center gap-2 py-12 text-center">
      <Archive class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
      <p class="text-base text-content-tertiary">{{ t('settings.archiveEmpty') }}</p>
    </div>

    <ul v-else class="divide-y divide-border">
      <li v-for="entry in entries" :key="entry.id" class="flex items-center justify-between gap-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-base text-content-primary">
            {{ nameOf(entry.originalPath) }}
          </p>
          <p class="truncate text-sm text-content-tertiary">
            {{ entry.originalPath }} · {{ t('settings.archivedOn', { date: formatDate(entry.archivedAt) }) }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            :title="t('settings.restore')"
            class="flex min-h-12 min-w-12 items-center justify-center rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary md:min-h-0 md:min-w-0 md:p-2.5"
            @click="restore(entry)"
          >
            <ArchiveRestore class="h-5 w-5" stroke-width="1.5" />
          </button>
          <button
            type="button"
            :title="t('settings.moveToTrash')"
            class="flex min-h-12 min-w-12 items-center justify-center rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-danger/10 hover:text-danger md:min-h-0 md:min-w-0 md:p-2.5"
            @click="pendingDelete = entry"
          >
            <Trash2 class="h-5 w-5" stroke-width="1.5" />
          </button>
        </div>
      </li>
    </ul>

    <ConfirmDialog
      v-if="pendingDelete"
      :title="t('settings.moveToTrash')"
      :message="t('settings.moveToTrashConfirm', { name: nameOf(pendingDelete.originalPath) })"
      :confirm-label="t('settings.moveAction')"
      @confirm="confirmDeleteToTrash"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
