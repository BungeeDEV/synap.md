export type ViewMode = 'editor' | 'reader'

export interface TabState {
  path: string
  title: string
  content: string
  dirty: boolean
  lastKnownMtime: string | null
  viewMode: ViewMode
}

export function titleFromPath(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.replace(/\.md$/i, '')
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabState[]>([])
  const activePath = ref<string | null>(null)

  const activeTab = computed(() => tabs.value.find((tab) => tab.path === activePath.value) ?? null)

  async function openTab(path: string): Promise<void> {
    const existing = tabs.value.find((tab) => tab.path === path)
    if (existing) {
      activePath.value = path
      return
    }

    const file = await $fetch<{ content: string, mtime: string }>('/api/vault/file', { query: { path } })

    tabs.value.push({
      path,
      title: titleFromPath(path),
      content: file.content,
      dirty: false,
      lastKnownMtime: file.mtime,
      viewMode: usePreferencesStore().preferences.defaultViewMode
    })
    activePath.value = path
  }

  function closeTab(path: string): void {
    const index = tabs.value.findIndex((tab) => tab.path === path)
    if (index === -1) return

    tabs.value.splice(index, 1)

    if (activePath.value === path) {
      const fallback = tabs.value[index] ?? tabs.value[index - 1]
      activePath.value = fallback?.path ?? null
    }
  }

  function setActiveTab(path: string): void {
    if (tabs.value.some((tab) => tab.path === path)) {
      activePath.value = path
    }
  }

  function updateContent(path: string, content: string): void {
    const tab = tabs.value.find((tab) => tab.path === path)
    if (!tab) return
    tab.content = content
    tab.dirty = true
  }

  /** Called after a successful save: clears dirty and syncs the new mtime baseline. */
  function markSaved(path: string, mtime: string): void {
    const tab = tabs.value.find((tab) => tab.path === path)
    if (!tab) return
    tab.dirty = false
    tab.lastKnownMtime = mtime
  }

  /** Syncs the mtime baseline without touching content/dirty - used to retry a save after "keep mine". */
  function syncMtime(path: string, mtime: string): void {
    const tab = tabs.value.find((tab) => tab.path === path)
    if (tab) tab.lastKnownMtime = mtime
  }

  /** Conflict resolution: discard local edits and load the on-disk version instead. */
  function loadExternalVersion(path: string, content: string, mtime: string): void {
    const tab = tabs.value.find((tab) => tab.path === path)
    if (!tab) return
    tab.content = content
    tab.dirty = false
    tab.lastKnownMtime = mtime
  }

  /**
   * Pulls the current on-disk content/mtime for each given path into any
   * open tab at that path - used after rename-propagation rewrote wikilinks
   * in other open notes, so the open tab (and the next autosave from it)
   * doesn't clobber the rewrite with stale in-memory content.
   */
  async function reconcileExternalContent(paths: string[]): Promise<void> {
    for (const path of paths) {
      if (!tabs.value.some((tab) => tab.path === path)) continue
      const file = await $fetch<{ content: string, mtime: string }>('/api/vault/file', { query: { path } })
      loadExternalVersion(path, file.content, file.mtime)
    }
  }

  function renameTab(oldPath: string, newPath: string): void {
    const tab = tabs.value.find((tab) => tab.path === oldPath)
    if (!tab) return
    tab.path = newPath
    tab.title = titleFromPath(newPath)
    if (activePath.value === oldPath) activePath.value = newPath
  }

  function setViewMode(path: string, viewMode: ViewMode): void {
    const tab = tabs.value.find((tab) => tab.path === path)
    if (tab) tab.viewMode = viewMode
  }

  return {
    tabs,
    activePath,
    activeTab,
    openTab,
    closeTab,
    setActiveTab,
    updateContent,
    markSaved,
    syncMtime,
    loadExternalVersion,
    reconcileExternalContent,
    renameTab,
    setViewMode
  }
})
