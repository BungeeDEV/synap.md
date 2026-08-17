import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useSynapApi } from '../api'
import { usePreferencesStore } from './preferences'

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

  // Tracks fetchFile() calls that haven't resolved yet, keyed by path - a
  // second openTab() for the same path while the first is still loading
  // (e.g. an impatient double-click) awaits the same in-flight request
  // instead of firing a redundant fetch and pushing a duplicate tab.
  const pendingOpens = new Map<string, Promise<void>>()

  /** `activate: false` opens/loads a background tab (e.g. "Öffnen in neuem Tab" from the context menu) without switching focus away from the currently active one. */
  async function openTab(path: string, options?: { activate?: boolean }): Promise<void> {
    const activate = options?.activate ?? true
    const existing = tabs.value.find((tab) => tab.path === path)
    if (existing) {
      if (activate) activePath.value = path
      return
    }

    // Set optimistically, before the fetch resolves, so the vault tree's
    // active-row highlight reacts to the click immediately instead of only
    // once the round-trip completes - the lack of that feedback is what
    // invited the double-click that caused the duplicate-tab race below.
    if (activate) activePath.value = path

    const inFlight = pendingOpens.get(path)
    if (inFlight) return inFlight

    const openPromise = (async () => {
      try {
        const file = await useSynapApi().fetchFile(path)
        // Re-check: another call could have completed and pushed this tab
        // while we were awaiting (shouldn't happen given the guard above,
        // but keeps this function safe to call concurrently regardless).
        if (!tabs.value.some((tab) => tab.path === path)) {
          tabs.value.push({
            path,
            title: titleFromPath(path),
            content: file.content,
            dirty: false,
            lastKnownMtime: file.mtime,
            viewMode: usePreferencesStore().preferences.defaultViewMode
          })
        }
      } finally {
        pendingOpens.delete(path)
      }
    })()

    pendingOpens.set(path, openPromise)
    return openPromise
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
    await Promise.all(paths.map(async (path) => {
      if (!tabs.value.some((tab) => tab.path === path)) return
      const file = await useSynapApi().fetchFile(path)
      loadExternalVersion(path, file.content, file.mtime)
    }))
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
