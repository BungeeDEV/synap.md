<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { Loader2, RotateCcw, Trash2 } from '@lucide/vue'

interface TrashEntry {
  id: number
  originalPath: string
  trashedPath: string
  deletedAt: number
  daysRemaining: number
}

const { show } = useToast()

const entries = ref<TrashEntry[]>([])
const loading = ref(true)
const pendingDelete = ref<TrashEntry | null>(null)
// Entries with a restore/delete request currently in flight - guards against
// a fast double-click firing the same request twice before the first
// response has a chance to remove the entry from the list below.
const pendingIds = ref<Set<number>>(new Set())

function isPending(id: number): boolean {
  return pendingIds.value.has(id)
}

function setPending(id: number, pending: boolean): void {
  const next = new Set(pendingIds.value)
  if (pending) next.add(id)
  else next.delete(id)
  pendingIds.value = next
}

async function load(): Promise<void> {
  loading.value = true
  try {
    entries.value = await $fetch<TrashEntry[]>('/api/trash/list')
  } finally {
    loading.value = false
  }
}

void load()

function nameOf(path: string): string {
  return path.split('/').pop() ?? path
}

function daysAgo(deletedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - deletedAt) / (24 * 60 * 60 * 1000)))
}

async function restore(entry: TrashEntry): Promise<void> {
  if (isPending(entry.id)) return
  setPending(entry.id, true)
  try {
    const result = await $fetch<{ path: string, renamed: boolean }>('/api/trash/restore', {
      method: 'POST',
      body: { id: entry.id }
    })
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    show(result.renamed
      ? t('settings.restoredAsRenamedToast', { name: nameOf(result.path) })
      : t('settings.restoredToast'))
  } catch {
    show(t('settings.restoreFailed'), 'error')
  } finally {
    setPending(entry.id, false)
  }
}

async function confirmDeletePermanent(): Promise<void> {
  if (!pendingDelete.value || isPending(pendingDelete.value.id)) return
  const entry = pendingDelete.value
  pendingDelete.value = null
  setPending(entry.id, true)

  try {
    await $fetch('/api/trash/delete-permanent', { method: 'POST', body: { id: entry.id } })
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    show(t('settings.permanentlyDeletedToast'))
  } catch {
    show(t('settings.deleteFailed'), 'error')
  } finally {
    setPending(entry.id, false)
  }
}
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">{{ t('settings.trashTitle') }}</h2>

    <SkeletonList v-if="loading" :rows="5" />

    <div v-else-if="entries.length === 0" class="flex flex-col items-center gap-2 py-12 text-center">
      <Trash2 class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
      <p class="text-base text-content-tertiary">{{ t('settings.trashEmpty') }}</p>
    </div>

    <ul v-else class="divide-y divide-border">
      <li v-for="entry in entries" :key="entry.id" class="flex items-center justify-between gap-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-base text-content-primary">
            {{ nameOf(entry.originalPath) }}
          </p>
          <p class="truncate text-sm text-content-tertiary">
            {{ entry.originalPath }} · {{ t('settings.deletedAgo', { count: daysAgo(entry.deletedAt), unit: daysAgo(entry.deletedAt) === 1 ? t('settings.day') : t('settings.days') }) }}
            · {{ t('settings.permanentDeleteIn', { count: entry.daysRemaining, unit: entry.daysRemaining === 1 ? t('settings.day') : t('settings.days') }) }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            :title="t('settings.restore')"
            :disabled="isPending(entry.id)"
            class="flex min-h-12 min-w-12 items-center justify-center rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary disabled:pointer-events-none disabled:opacity-50 md:min-h-0 md:min-w-0 md:p-2.5"
            @click="restore(entry)"
          >
            <Loader2 v-if="isPending(entry.id)" class="h-5 w-5 animate-spin" stroke-width="1.5" />
            <RotateCcw v-else class="h-5 w-5" stroke-width="1.5" />
          </button>
          <button
            type="button"
            :title="t('settings.deletePermanently')"
            :disabled="isPending(entry.id)"
            class="flex min-h-12 min-w-12 items-center justify-center rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-50 md:min-h-0 md:min-w-0 md:p-2.5"
            @click="pendingDelete = entry"
          >
            <Trash2 class="h-5 w-5" stroke-width="1.5" />
          </button>
        </div>
      </li>
    </ul>

    <ConfirmDialog
      v-if="pendingDelete"
      :title="t('settings.deletePermanently')"
      :message="t('settings.deleteIrreversibleConfirm', { name: nameOf(pendingDelete.originalPath) })"
      :confirm-label="t('settings.deletePermanently')"
      @confirm="confirmDeletePermanent"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
