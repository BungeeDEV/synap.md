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

export const useVaultTreeStore = defineStore('vaultTree', () => {
  const tree = ref<VaultTreeNode[]>([])
  const expanded = ref(new Set<string>())
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Path of the folder new-file/new-folder toolbar actions target - '' means vault root.
  const selectedFolder = ref('')

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

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      tree.value = await $fetch<VaultTreeNode[]>('/api/vault/tree')
    } catch {
      error.value = 'Vault-Struktur konnte nicht geladen werden'
    } finally {
      loading.value = false
    }
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
  }

  function expand(path: string): void {
    expanded.value.add(path)
  }

  function selectFolder(path: string): void {
    selectedFolder.value = path
  }

  function toggleExpandAll(): void {
    expanded.value = allExpanded.value ? new Set() : new Set(folderPaths.value)
  }

  return {
    tree,
    loading,
    error,
    selectedFolder,
    stats,
    allExpanded,
    refresh,
    isExpanded,
    toggleExpand,
    expand,
    selectFolder,
    toggleExpandAll
  }
})
