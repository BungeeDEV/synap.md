import type { VaultTreeNode } from '~/stores/vaultTree'

export type VaultSortMode = 'name-asc' | 'name-desc' | 'mtime-desc' | 'mtime-asc'

export const VAULT_SORT_ORDER: VaultSortMode[] = ['name-asc', 'name-desc', 'mtime-desc', 'mtime-asc']

export const VAULT_SORT_LABELS: Record<VaultSortMode, string> = {
  'name-asc': 'Name A-Z',
  'name-desc': 'Name Z-A',
  'mtime-desc': 'Zuletzt geändert',
  'mtime-asc': 'Älteste zuerst'
}

function compare(a: VaultTreeNode, b: VaultTreeNode, mode: VaultSortMode): number {
  if (mode === 'name-asc') return a.name.localeCompare(b.name)
  if (mode === 'name-desc') return b.name.localeCompare(a.name)
  // Folders carry no mtime, so within the folder group fall back to name order.
  if (a.type === 'folder' && b.type === 'folder') return a.name.localeCompare(b.name)
  const diff = (a.mtime ?? 0) - (b.mtime ?? 0)
  return mode === 'mtime-desc' ? -diff : diff
}

/** Non-mutating recursive sort - folders stay grouped before files at every level, matching the server's existing grouping. */
export function sortVaultTree(nodes: VaultTreeNode[], mode: VaultSortMode): VaultTreeNode[] {
  const folders = nodes
    .filter((node) => node.type === 'folder')
    .map((node) => ({ ...node, children: node.children ? sortVaultTree(node.children, mode) : node.children }))
    .sort((a, b) => compare(a, b, mode))

  const files = nodes.filter((node) => node.type === 'file').sort((a, b) => compare(a, b, mode))

  return [...folders, ...files]
}
