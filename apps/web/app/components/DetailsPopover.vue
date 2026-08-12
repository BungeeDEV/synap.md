<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { VaultTreeNode } from '@synap/store'
import { formatDate } from '#shared/formatDate'
import { formatBytes } from '~/utils/formatBytes'
import { countChars, countWords } from '~/utils/textStats'

const props = defineProps<{ node: VaultTreeNode }>()
const emit = defineEmits<{ close: [] }>()

interface FileDetails { kind: 'file', createdAt: string, mtime: string, words: number, chars: number }
interface FolderDetails { kind: 'folder', noteCount: number, folderCount: number, totalSizeBytes: number }

const loading = ref(true)
const details = ref<FileDetails | FolderDetails | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    if (props.node.type === 'file') {
      const file = await $fetch<{ content: string, mtime: string, createdAt: string }>('/api/vault/file', { query: { path: props.node.path } })
      details.value = { kind: 'file', createdAt: file.createdAt, mtime: file.mtime, words: countWords(file.content), chars: countChars(file.content) }
    } else {
      const stats = await $fetch<{ noteCount: number, folderCount: number, totalSizeBytes: number }>('/api/vault/folder-stats', { query: { path: props.node.path } })
      details.value = { kind: 'folder', ...stats }
    }
  } finally {
    loading.value = false
  }
}

function formatTimestamp(iso: string): string {
  return formatDate(new Date(iso), 'YYYY-MM-DD HH:mm')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void load()
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <!-- Teleported to <body>: opened from VaultTree.vue, mounted inside
       VaultSidebar's transformed <aside> - see ContextMenu.vue's Teleport
       comment. -->
  <Teleport to="body">
  <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="emit('close')">
      <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
        <div class="w-full max-w-sm rounded-xl border border-border-strong bg-surface-1 p-6 text-base text-content-primary shadow-float" @click.stop>
          <div class="mb-4 flex items-start justify-between gap-2">
            <h2 class="font-semibold text-content-primary">
              Details
            </h2>
            <button
              type="button"
              class="rounded-md p-1 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              @click="emit('close')"
            >
              <X class="h-4 w-4" stroke-width="1.5" />
            </button>
          </div>

          <p class="mb-4 truncate text-sm text-content-tertiary">
            {{ node.name }}
          </p>

          <p v-if="loading" class="text-sm text-content-tertiary">
            Lädt…
          </p>

          <dl v-else-if="details?.kind === 'file'" class="space-y-2.5 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Erstellt
              </dt>
              <dd class="text-content-primary">
                {{ formatTimestamp(details.createdAt) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Zuletzt geändert
              </dt>
              <dd class="text-content-primary">
                {{ formatTimestamp(details.mtime) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Wörter
              </dt>
              <dd class="text-content-primary">
                {{ details.words }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Zeichen
              </dt>
              <dd class="text-content-primary">
                {{ details.chars }}
              </dd>
            </div>
          </dl>

          <dl v-else-if="details?.kind === 'folder'" class="space-y-2.5 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Notizen
              </dt>
              <dd class="text-content-primary">
                {{ details.noteCount }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Unterordner
              </dt>
              <dd class="text-content-primary">
                {{ details.folderCount }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-content-tertiary">
                Größe
              </dt>
              <dd class="text-content-primary">
                {{ formatBytes(details.totalSizeBytes) }}
              </dd>
            </div>
          </dl>
        </div>
      </Transition>
    </div>
  </Transition>
  </Teleport>
</template>
