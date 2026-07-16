const SAVE_DEBOUNCE_MS = 1500

interface ConflictState {
  currentContent: string
  currentMtime: string
}

/** Debounced autosave for a single open tab, with Ctrl/Cmd+S bypass and 409 conflict handling. */
export function useAutosave(path: string) {
  const tabs = useTabsStore()

  const saving = ref(false)
  const conflict = ref<ConflictState | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function performSave(force: boolean): Promise<void> {
    const tab = tabs.tabs.find((t) => t.path === path)
    if (!tab) return
    if (!force && !tab.dirty) return

    saving.value = true
    try {
      const response = await $fetch<{ path: string, mtime: string }>('/api/vault/file', {
        method: 'PUT',
        body: { path: tab.path, content: tab.content, lastKnownMtime: tab.lastKnownMtime }
      })
      tabs.markSaved(tab.path, response.mtime)
    } catch (err) {
      const fetchError = err as { statusCode?: number, data?: { data?: ConflictState } }
      if (fetchError.statusCode === 409) {
        const payload = fetchError.data?.data
        conflict.value = {
          currentContent: payload?.currentContent ?? '',
          currentMtime: payload?.currentMtime ?? tab.lastKnownMtime ?? ''
        }
      } else {
        throw err
      }
    } finally {
      saving.value = false
    }
  }

  /** Debounced save - call on every content change. */
  function save(): void {
    clearTimer()
    timer = setTimeout(() => { void performSave(false) }, SAVE_DEBOUNCE_MS)
  }

  /** Immediate save, bypassing the debounce (Ctrl/Cmd+S). */
  function saveNow(): void {
    clearTimer()
    void performSave(true)
  }

  /** Conflict resolution: overwrite the on-disk version with the local (dirty) content. */
  function keepMine(): void {
    if (!conflict.value) return
    tabs.syncMtime(path, conflict.value.currentMtime)
    conflict.value = null
    void performSave(true)
  }

  /** Conflict resolution: discard local edits and load the on-disk version. */
  function loadTheirs(): void {
    if (!conflict.value) return
    tabs.loadExternalVersion(path, conflict.value.currentContent, conflict.value.currentMtime)
    conflict.value = null
  }

  onBeforeUnmount(() => clearTimer())

  return { saving, conflict, save, saveNow, keepMine, loadTheirs }
}
