<script setup lang="ts">
import { RotateCcw, Trash2 } from 'lucide-vue-next'

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
  try {
    const result = await $fetch<{ path: string, renamed: boolean }>('/api/trash/restore', {
      method: 'POST',
      body: { id: entry.id }
    })
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    show(result.renamed
      ? `Wiederhergestellt als "${nameOf(result.path)}" (Name war bereits vergeben)`
      : 'Wiederhergestellt')
  } catch {
    show('Wiederherstellen fehlgeschlagen', 'error')
  }
}

async function confirmDeletePermanent(): Promise<void> {
  if (!pendingDelete.value) return
  const entry = pendingDelete.value
  pendingDelete.value = null

  try {
    await $fetch('/api/trash/delete-permanent', { method: 'POST', body: { id: entry.id } })
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    show('Endgültig gelöscht')
  } catch {
    show('Löschen fehlgeschlagen', 'error')
  }
}
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
      Papierkorb
    </h2>

    <p v-if="loading" class="text-sm text-content-tertiary">
      Lädt…
    </p>

    <div v-else-if="entries.length === 0" class="flex flex-col items-center gap-2 py-12 text-center">
      <Trash2 class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
      <p class="text-base text-content-tertiary">
        Der Papierkorb ist leer.
      </p>
    </div>

    <ul v-else class="divide-y divide-border">
      <li v-for="entry in entries" :key="entry.id" class="flex items-center justify-between gap-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-base text-content-primary">
            {{ nameOf(entry.originalPath) }}
          </p>
          <p class="truncate text-sm text-content-tertiary">
            {{ entry.originalPath }} · gelöscht vor {{ daysAgo(entry.deletedAt) }} {{ daysAgo(entry.deletedAt) === 1 ? 'Tag' : 'Tagen' }}
            · wird in {{ entry.daysRemaining }} {{ entry.daysRemaining === 1 ? 'Tag' : 'Tagen' }} endgültig gelöscht
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="Wiederherstellen"
            class="flex min-h-12 min-w-12 items-center justify-center rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary md:min-h-0 md:min-w-0 md:p-2.5"
            @click="restore(entry)"
          >
            <RotateCcw class="h-5 w-5" stroke-width="1.5" />
          </button>
          <button
            type="button"
            title="Endgültig löschen"
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
      title="Endgültig löschen"
      :message="`„${nameOf(pendingDelete.originalPath)}“ wird unwiderruflich gelöscht.`"
      confirm-label="Endgültig löschen"
      @confirm="confirmDeletePermanent"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
