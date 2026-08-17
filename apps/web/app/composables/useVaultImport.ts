import { useI18n } from 'vue-i18n'
import type { ImportConflictAction } from '#shared/import'

const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024
const PANEL_FILE_COUNT_THRESHOLD = 2
const PANEL_LARGE_FILE_BYTES = 1 * 1024 * 1024
const FLASH_DURATION_MS = 1600
const AUTO_CLOSE_PANEL_MS = 4000

export interface ImportDialogState {
  files: File[]
  targetFolder: string
}

export interface ImportProgressFile {
  file: File
  name: string
  path: string | null
  status: 'pending' | 'uploading' | 'imported' | 'skipped' | 'cancelled' | 'error'
  error?: string
  conflictAction: ImportConflictAction
}

export interface ImportProgressState {
  targetFolder: string
  files: ImportProgressFile[]
  collapsed: boolean
  cancelRequested: boolean
  done: boolean
}

export interface ImportEntry {
  file: File
  onConflict: ImportConflictAction
}

interface ImportUploadResponse { path: string | null, status: 'imported' | 'skipped' }

/** Is this file large enough that the import dialog should show a soft, non-blocking size warning? */
export function isLargeImportFile(size: number): boolean {
  return size > LARGE_FILE_WARNING_BYTES
}

/**
 * All import state/orchestration in one place, so the three entry points
 * (folder context menu, toolbar overflow, external drag&drop - all in
 * VaultTree.vue) and the two UI surfaces (ImportDialog.vue, mounted next to
 * ConfirmDialog/DetailsPopover in VaultTree.vue; ImportProgressPanel.vue,
 * mounted globally in app.vue since an import must keep showing progress
 * even if the user navigates away from the tree) share one implementation
 * instead of three copies of upload/conflict/reveal logic.
 */
export function useVaultImport() {
  const dialog = useState<ImportDialogState | null>('importDialogState', () => null)
  const progress = useState<ImportProgressState | null>('importProgressState', () => null)
  // Paths that just landed via import - VaultTree.vue reads this to apply a
  // brief one-shot background flash per row, see flashImportedPaths() below.
  const recentlyImported = useState<Set<string>>('vaultTreeRecentlyImportedPaths', () => new Set())

  const vaultTree = useVaultTreeStore()
  const sidebarPanel = useSidebarPanelStore()
  const tabs = useTabsStore()
  const toast = useToast()
  const { t } = useI18n()

  function openImportDialog(files: File[], targetFolder: string): void {
    if (files.length === 0) return
    dialog.value = { files, targetFolder }
  }

  function closeImportDialog(): void {
    dialog.value = null
  }

  function expandFolderChain(path: string): void {
    if (!path) return
    let prefix = ''
    for (const segment of path.split('/')) {
      prefix = prefix ? `${prefix}/${segment}` : segment
      vaultTree.expand(prefix)
    }
  }

  function revealFolder(targetFolder: string): void {
    sidebarPanel.setPanel('explorer')
    expandFolderChain(targetFolder)
  }

  function flashImportedPaths(paths: string[]): void {
    if (paths.length === 0) return
    recentlyImported.value = new Set([...recentlyImported.value, ...paths])
    setTimeout(() => {
      const next = new Set(recentlyImported.value)
      for (const path of paths) next.delete(path)
      recentlyImported.value = next
    }, FLASH_DURATION_MS)
  }

  async function afterFilesLanded(targetFolder: string, importedPaths: string[]): Promise<void> {
    if (importedPaths.length === 0) return
    await vaultTree.refresh()
    revealFolder(targetFolder)
    flashImportedPaths(importedPaths)
  }

  async function uploadOne(file: File, targetFolder: string, onConflict: ImportConflictAction): Promise<{ path: string | null, status: ImportProgressFile['status'], error?: string }> {
    const body = new FormData()
    body.append('file', file)
    body.append('targetFolder', targetFolder)
    body.append('onConflict', onConflict)

    try {
      const response = await $fetch<ImportUploadResponse>('/api/vault/import', { method: 'POST', body })
      return { path: response.path, status: response.status }
    } catch (err) {
      const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      return { path: null, status: 'error', error: statusMessage ?? t('import.importFailed') }
    }
  }

  function closeProgressPanel(): void {
    progress.value = null
  }

  function toggleProgressCollapsed(): void {
    if (progress.value) progress.value.collapsed = !progress.value.collapsed
  }

  function cancelRemaining(): void {
    if (progress.value) progress.value.cancelRequested = true
  }

  function scheduleAutoClose(): void {
    setTimeout(() => {
      if (progress.value?.done && !progress.value.files.some((f) => f.status === 'error')) {
        closeProgressPanel()
      }
    }, AUTO_CLOSE_PANEL_MS)
  }

  /** Runs the whole batch. Shows a floating panel for anything beyond "a couple of small files" (per spec); otherwise a single toast once everything settles. */
  async function runImport(targetFolder: string, entries: ImportEntry[]): Promise<void> {
    if (entries.length === 0) return

    const usePanel = entries.length > PANEL_FILE_COUNT_THRESHOLD || entries.some((e) => e.file.size > PANEL_LARGE_FILE_BYTES)

    if (usePanel) {
      progress.value = {
        targetFolder,
        files: entries.map((e) => ({ file: e.file, name: e.file.name, path: null, status: 'pending', conflictAction: e.onConflict })),
        collapsed: false,
        cancelRequested: false,
        done: false
      }
    }

    const importedPaths: string[] = []
    let importedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!

      if (progress.value?.cancelRequested) {
        if (progress.value) progress.value.files[i] = { ...progress.value.files[i]!, status: 'cancelled' }
        continue
      }

      if (progress.value) progress.value.files[i] = { ...progress.value.files[i]!, status: 'uploading' }

      const result = await uploadOne(entry.file, targetFolder, entry.onConflict)

      if (progress.value) {
        progress.value.files[i] = { ...progress.value.files[i]!, status: result.status, path: result.path, error: result.error }
      }
      if (result.status === 'imported' && result.path) {
        importedPaths.push(result.path)
        importedCount++
      } else if (result.status === 'skipped') {
        skippedCount++
      } else if (result.status === 'error') {
        errorCount++
      }
    }

    if (progress.value) {
      progress.value.done = true
      scheduleAutoClose()
    }

    await afterFilesLanded(targetFolder, importedPaths)
    if (importedPaths.length === 1) await tabs.openTab(importedPaths[0]!)

    if (!usePanel) {
      const parts = [
        importedCount > 0 ? t('import.importedCount', { count: importedCount, unit: importedCount === 1 ? t('import.file') : t('import.files') }) : null,
        skippedCount > 0 ? t('import.skippedCount', { count: skippedCount }) : null,
        errorCount > 0 ? t('import.failedCount', { count: errorCount }) : null
      ].filter((part): part is string => part !== null)

      toast.show(
        parts.join(', ') || t('import.completed'),
        errorCount > 0 && importedCount === 0 ? 'error' : 'default',
        importedPaths.length > 0 ? { label: t('import.jumpToFolder'), onClick: () => revealFolder(targetFolder) } : undefined
      )
    }
  }

  /** Re-runs just one failed entry from the progress panel, in place. */
  async function retryImportFile(index: number): Promise<void> {
    const state = progress.value
    const entry = state?.files[index]
    if (!state || !entry || entry.status !== 'error') return

    state.files[index] = { ...entry, status: 'uploading', error: undefined }
    const result = await uploadOne(entry.file, state.targetFolder, entry.conflictAction)
    state.files[index] = { ...state.files[index]!, status: result.status, path: result.path, error: result.error }

    if (result.status === 'imported' && result.path) {
      await afterFilesLanded(state.targetFolder, [result.path])
    }
  }

  return {
    dialog,
    progress,
    recentlyImported,
    openImportDialog,
    closeImportDialog,
    runImport,
    retryImportFile,
    cancelRemaining,
    closeProgressPanel,
    toggleProgressCollapsed,
    revealFolder
  }
}
