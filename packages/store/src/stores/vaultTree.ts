import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'
import { useSynapApi } from '../api'
import { usePreferencesStore } from './preferences'

export interface VaultTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: VaultTreeNode[]
  mtime?: number
}

function collectFolderPaths(nodes: VaultTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type !== 'folder') continue
    paths.push(node.path)
    if (node.children) paths.push(...collectFolderPaths(node.children))
  }
  return paths
}

function findNode(nodes: VaultTreeNode[], path: string): VaultTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.type === 'folder' && node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return null
}

/** Returns the live `children` array of the folder at `folderPath` (creating it if the folder had none yet), or the root `tree` array for `''`. Null only if `folderPath` doesn't resolve to a folder currently in the tree. */
function childrenArrayOf(nodes: VaultTreeNode[], folderPath: string): VaultTreeNode[] | null {
  if (!folderPath) return nodes
  const folder = findNode(nodes, folderPath)
  if (!folder || folder.type !== 'folder') return null
  if (!folder.children) folder.children = []
  return folder.children
}

/** Splices the node at `path` out of whichever array currently holds it and returns it (subtree intact), or null if not found locally. */
function spliceNode(nodes: VaultTreeNode[], path: string): VaultTreeNode | null {
  const index = nodes.findIndex((node) => node.path === path)
  if (index !== -1) return nodes.splice(index, 1)[0] ?? null
  for (const node of nodes) {
    if (node.type === 'folder' && node.children) {
      const removed = spliceNode(node.children, path)
      if (removed) return removed
    }
  }
  return null
}

/** A folder rename/move preserves every descendant's position relative to the moved root untouched - only the path prefix changes - so descendant paths can be rewritten by simple prefix substitution instead of needing the server to enumerate them. */
function rewriteDescendantPaths(nodes: VaultTreeNode[], oldPrefix: string, newPrefix: string): void {
  for (const node of nodes) {
    node.path = newPrefix + node.path.slice(oldPrefix.length)
    if (node.type === 'folder' && node.children) rewriteDescendantPaths(node.children, oldPrefix, newPrefix)
  }
}

const EXPANDED_PERSIST_DEBOUNCE_MS = 1500

export const useVaultTreeStore = defineStore('vaultTree', () => {
  const tree = ref<VaultTreeNode[]>([])
  const expanded = ref(new Set<string>())
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Path of the folder new-file/new-folder toolbar actions target - '' means vault root.
  const selectedFolder = ref('')

  const preferences = usePreferencesStore()
  // Seeded once from server preferences (which load async), so an empty
  // `expanded` at store-creation time doesn't get persisted over a
  // not-yet-loaded server value - see the `loaded` watcher below.
  let expandedHydrated = false
  let persistExpandedTimer: ReturnType<typeof setTimeout> | null = null

  watch(() => preferences.loaded, (loaded) => {
    if (!loaded || expandedHydrated) return
    expandedHydrated = true
    expanded.value = new Set(preferences.preferences.expandedFolders)
  }, { immediate: true })

  /** Debounced, synced across devices via the same preferences_json column as the rest of EditorPreferences - not persisted before hydration so a fast toggle can't overwrite the still-loading server value with an empty set. */
  function persistExpanded(): void {
    if (!expandedHydrated) return
    if (persistExpandedTimer) clearTimeout(persistExpandedTimer)
    persistExpandedTimer = setTimeout(() => {
      void preferences.update({ expandedFolders: [...expanded.value] })
    }, EXPANDED_PERSIST_DEBOUNCE_MS)
  }

  const stats = computed(() => {
    let files = 0
    let folders = 0
    function walk(nodes: VaultTreeNode[]): void {
      for (const node of nodes) {
        if (node.type === 'folder') {
          folders++
          if (node.children) walk(node.children)
        } else {
          files++
        }
      }
    }
    walk(tree.value)
    return { files, folders }
  })

  const folderPaths = computed(() => collectFolderPaths(tree.value))
  const allExpanded = computed(() => folderPaths.value.length > 0 && folderPaths.value.every((path) => expanded.value.has(path)))

  /**
   * Only shows the loading (skeleton) state on the true first load. Every
   * later call - after a create/rename/delete/move/etc. - is a background
   * refresh: the previous tree stays on screen and is swapped for the new
   * one once it resolves, instead of the whole sidebar flashing to
   * skeleton rows on every single mutation.
   */
  async function refresh(): Promise<void> {
    const isFirstLoad = tree.value.length === 0
    if (isFirstLoad) loading.value = true
    error.value = null
    try {
      tree.value = await useSynapApi().fetchTree()
    } catch {
      error.value = 'Vault-Struktur konnte nicht geladen werden'
    } finally {
      if (isFirstLoad) loading.value = false
    }
  }

  /**
   * Local-patch counterpart to `refresh()` for mutations whose API response
   * already carries everything needed to update the tree without a round
   * trip to `GET /api/vault/tree` - inserts `node` into the folder at
   * `parentPath` (`''` for vault root). Falls back to a full `refresh()`
   * if that folder isn't present locally (shouldn't normally happen, but
   * a stale/drifted local tree is worse than one extra fetch).
   */
  function insertNode(node: VaultTreeNode, parentPath: string): void {
    const siblings = childrenArrayOf(tree.value, parentPath)
    if (!siblings) {
      void refresh()
      return
    }
    siblings.push(node)
  }

  /** Local-patch counterpart to `refresh()` for delete/archive: removes the node at `path` (and its subtree) from wherever it currently lives in the tree. No-op if it isn't found locally. */
  function removeNode(path: string): void {
    spliceNode(tree.value, path)
  }

  /**
   * Local-patch counterpart to `refresh()` for rename and move - both go
   * through the same `POST /api/vault/rename` endpoint server-side (a
   * rename-in-place is just a move within the same parent folder), so one
   * function handles both: splice the node out of its current parent,
   * rewrite its own path/name plus any descendants' paths (prefix swap -
   * safe because a filesystem rename preserves the subtree untouched
   * beneath the renamed root), then re-insert it under `newPath`'s parent.
   * Falls back to `refresh()` if the node or its new parent folder can't
   * be found locally.
   */
  function relocateNode(oldPath: string, newPath: string): void {
    const node = spliceNode(tree.value, oldPath)
    if (!node) {
      void refresh()
      return
    }
    if (node.type === 'folder' && node.children) {
      rewriteDescendantPaths(node.children, oldPath, newPath)
    }
    node.name = newPath.split('/').pop() ?? newPath
    node.path = newPath
    const newParentPath = newPath.includes('/') ? newPath.slice(0, newPath.lastIndexOf('/')) : ''
    const siblings = childrenArrayOf(tree.value, newParentPath)
    if (!siblings) {
      void refresh()
      return
    }
    siblings.push(node)
  }

  function isExpanded(path: string): boolean {
    return expanded.value.has(path)
  }

  function toggleExpand(path: string): void {
    if (expanded.value.has(path)) {
      expanded.value.delete(path)
    } else {
      expanded.value.add(path)
    }
    persistExpanded()
  }

  function expand(path: string): void {
    expanded.value.add(path)
    persistExpanded()
  }

  function selectFolder(path: string): void {
    selectedFolder.value = path
  }

  function toggleExpandAll(): void {
    expanded.value = allExpanded.value ? new Set() : new Set(folderPaths.value)
    persistExpanded()
  }

  return {
    tree,
    loading,
    error,
    selectedFolder,
    stats,
    allExpanded,
    refresh,
    insertNode,
    removeNode,
    relocateNode,
    isExpanded,
    toggleExpand,
    expand,
    selectFolder,
    toggleExpandAll
  }
})
