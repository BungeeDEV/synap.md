<script setup lang="ts">
import { AlertTriangle, FileText, FileWarning, Upload } from '@lucide/vue'
import type { ImportConflictAction } from '#shared/import'
import { isMarkdownImportFilename } from '#shared/import'
import type { VaultTreeNode } from '@synap/store'
import { useI18n } from 'vue-i18n'
import { formatBytes } from '~/utils/formatBytes'
import { folderOptionsOf } from '~/utils/vaultFolders'

const { t } = useI18n()
const { dialog, closeImportDialog, runImport } = useVaultImport()
const vaultTree = useVaultTreeStore()

const selectedFolder = ref('')
const globalConflictAction = ref<ImportConflictAction>('keep-both')
const perFileOverride = reactive<Record<string, ImportConflictAction | undefined>>({})

// dialog.value is replaced wholesale on every openImportDialog() call - reset
// local editable state (target folder, per-file overrides) each time rather
// than carrying over a previous import's choices.
watch(dialog, (state) => {
  if (!state) return
  selectedFolder.value = state.targetFolder
  for (const key of Object.keys(perFileOverride)) perFileOverride[key] = undefined
})

const folderOptions = computed(() => folderOptionsOf(vaultTree.tree, t('tree.vaultRoot')))

// Native <select><option> can't take Tailwind indent classes like the
// ContextMenuMoveSubmenu folder list does, so depth is faked with leading
// full-width spaces instead - written as an escape sequence, not a literal
// character, so eslint's no-irregular-whitespace rule doesn't flag it in the source.
const FULL_WIDTH_SPACE = String.fromCharCode(0x3000)

function folderOptionLabel(option: { name: string, depth: number }): string {
  return FULL_WIDTH_SPACE.repeat(option.depth) + option.name
}

const markdownFiles = computed(() => dialog.value?.files.filter((file) => isMarkdownImportFilename(file.name)) ?? [])
const rejectedFiles = computed(() => dialog.value?.files.filter((file) => !isMarkdownImportFilename(file.name)) ?? [])

// UI-only preview so the dialog can show "this one already exists" - the
// import endpoint re-checks the real filesystem itself before writing
// anything, so a stale client-side tree here can never cause data loss.
const existingNamesInTarget = computed(() => {
  function findFolder(nodes: VaultTreeNode[], path: string): VaultTreeNode | null {
    if (!path) return null
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.type === 'folder' && node.children) {
        const found = findFolder(node.children, path)
        if (found) return found
      }
    }
    return null
  }

  const siblings = selectedFolder.value ? findFolder(vaultTree.tree, selectedFolder.value)?.children ?? [] : vaultTree.tree
  return new Set(siblings.filter((node) => node.type === 'file').map((node) => node.name.replace(/\.md$/i, '')))
})

function baseNameOf(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, '')
}

function conflicts(file: File): boolean {
  return existingNamesInTarget.value.has(baseNameOf(file.name))
}

const hasAnyConflict = computed(() => markdownFiles.value.some(conflicts))

function effectiveAction(file: File): ImportConflictAction {
  return perFileOverride[file.name] ?? globalConflictAction.value
}

function handleCancel(): void {
  closeImportDialog()
}

function handleConfirm(): void {
  const targetFolder = selectedFolder.value
  const entries = markdownFiles.value.map((file) => ({ file, onConflict: effectiveAction(file) }))
  closeImportDialog()
  void runImport(targetFolder, entries)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') handleCancel()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <!-- Teleported to <body>: opened from VaultTree.vue, mounted inside
       VaultSidebar's transformed <aside> - see ContextMenu.vue's Teleport
       comment. -->
  <Teleport to="body">
  <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="dialog" class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="handleCancel">
      <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
        <div class="mx-4 flex max-h-dialog w-full max-w-lg flex-col rounded-xl border border-border-strong bg-surface-1 shadow-float" @click.stop>
          <div class="shrink-0 border-b border-border px-4 py-3">
            <h2 class="flex items-center gap-2 font-semibold text-content-primary">
              <Upload class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
              {{ t('dialogs.importFiles') }}
            </h2>
          </div>

          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-content-secondary" for="import-target-folder">
                {{ t('dialogs.targetFolder') }}
              </label>
              <select
                id="import-target-folder"
                v-model="selectedFolder"
                class="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                <option v-for="option in folderOptions" :key="option.path || '__root__'" :value="option.path">
                  {{ folderOptionLabel(option) }}
                </option>
              </select>
            </div>

            <ul class="space-y-1.5">
              <li
                v-for="file in dialog?.files ?? []"
                :key="file.name"
                class="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
                :class="isMarkdownImportFilename(file.name) ? '' : 'opacity-50'"
              >
                <FileWarning v-if="!isMarkdownImportFilename(file.name)" class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
                <FileText v-else class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-content-primary">
                    {{ file.name }}
                  </p>
                  <p class="flex flex-wrap items-center gap-x-1.5 text-xs text-content-tertiary">
                    <span>{{ formatBytes(file.size) }}</span>
                    <span v-if="!isMarkdownImportFilename(file.name)" class="text-danger">
                      · {{ t('import.notMarkdown') }}
                    </span>
                    <span v-else-if="isLargeImportFile(file.size)" class="flex items-center gap-1 text-content-tertiary">
                      · <AlertTriangle class="h-3 w-3" stroke-width="1.5" /> {{ t('import.large') }}
                    </span>
                    <span v-if="isMarkdownImportFilename(file.name) && conflicts(file)" class="text-accent">
                      · {{ t('import.exists') }}
                    </span>
                  </p>
                </div>

                <select
                  v-if="isMarkdownImportFilename(file.name) && conflicts(file)"
                  v-model="perFileOverride[file.name]"
                  class="shrink-0 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-xs text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  <option :value="undefined">
                    {{ t('import.defaultAction', { action: globalConflictAction === 'skip' ? t('import.skip') : globalConflictAction === 'replace' ? t('import.replace') : t('import.keepBoth') }) }}
                  </option>
                  <option value="skip">
                    {{ t('import.skip') }}
                  </option>
                  <option value="replace">
                    {{ t('import.replace') }}
                  </option>
                  <option value="keep-both">
                    {{ t('import.keepBoth') }}
                  </option>
                </select>
              </li>
            </ul>

            <div v-if="hasAnyConflict" class="flex items-center gap-2 text-sm">
              <span class="text-content-secondary">{{ t('import.onConflictDefault') }}</span>
              <select
                v-model="globalConflictAction"
                class="rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                <option value="skip">
                  {{ t('import.skip') }}
                </option>
                <option value="replace">
                  {{ t('import.replace') }}
                </option>
                <option value="keep-both">
                  {{ t('import.keepBoth') }}
                </option>
              </select>
            </div>

            <p v-if="rejectedFiles.length && markdownFiles.length === 0" class="text-sm text-danger">
              {{ t('import.noMarkdownFiles') }}
            </p>
          </div>

          <div class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              class="rounded-md border border-border-strong px-4 py-2 text-content-primary transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-accent/50"
              @click="handleCancel"
            >
              {{ t('dialogs.cancel') }}
            </button>
            <button
              type="button"
              :disabled="markdownFiles.length === 0"
              class="rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
              @click="handleConfirm"
            >
              {{ t('import.importButton', { count: markdownFiles.length, unit: markdownFiles.length === 1 ? t('import.file') : t('import.files') }) }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
  </Teleport>
</template>
