export interface MoveSource {
  path: string
  type: 'file' | 'folder'
}

export function parentFolderOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

/** Shared by VaultTree's native drag & drop and MoveToDialog's picker, so both reject the same targets: dropping onto self, into a folder's own subtree, or into the current parent (no-op). */
export function isValidMoveTarget(source: MoveSource, targetFolderPath: string): boolean {
  if (source.path === targetFolderPath) return false
  if (source.type === 'folder' && (targetFolderPath === source.path || targetFolderPath.startsWith(`${source.path}/`))) return false
  if (parentFolderOf(source.path) === targetFolderPath) return false
  return true
}
