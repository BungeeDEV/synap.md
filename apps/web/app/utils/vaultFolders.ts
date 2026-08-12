import type { VaultTreeNode } from '~/stores/vaultTree'

export interface FolderOption { path: string, name: string, depth: number }

// Depth capped at the same level OutlinePanel's heading indent uses -
// Tailwind classes only, no arbitrary per-depth inline styles.
const INDENT_CLASSES: Record<number, string> = {
  0: 'pl-2',
  1: 'pl-4',
  2: 'pl-6',
  3: 'pl-8',
  4: 'pl-10',
  5: 'pl-12'
}

export function folderIndentClass(depth: number): string {
  return INDENT_CLASSES[Math.min(depth, 5)]!
}

function flattenFolders(nodes: VaultTreeNode[], depth: number): FolderOption[] {
  const result: FolderOption[] = []
  for (const node of nodes) {
    if (node.type !== 'folder') continue
    result.push({ path: node.path, name: node.name, depth })
    if (node.children) result.push(...flattenFolders(node.children, depth + 1))
  }
  return result
}

/** Flat, depth-annotated folder list for folder-picker UIs (ContextMenuMoveSubmenu, ImportDialog), rooted with an explicit vault-root entry. */
export function folderOptionsOf(tree: VaultTreeNode[]): FolderOption[] {
  return [{ path: '', name: 'Vault-Wurzel', depth: 0 }, ...flattenFolders(tree, 1)]
}
