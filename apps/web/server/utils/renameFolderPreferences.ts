import type { EditorPreferences } from '@synap/store/preferences_types'

/**
 * After a folder rename/move, rewrites every vault-relative path stored in
 * `prefs` that fell under the renamed folder - same prefix substitution as
 * `renameFolderInIndex` (search index) and the client-side tree's
 * `rewriteDescendantPaths()`. Without this, a favorited/expanded/colored
 * folder or file nested under the renamed folder silently falls out of
 * favorites/expand-state/folder-color, since none of those consumers
 * re-resolve a stale path - they just drop whatever no longer matches the
 * live tree (see VaultSidebar.vue's `favoriteEntries` comment).
 *
 * Kept in its own file rather than alongside `parsePreferences()` in
 * preferences.ts: that file imports `@synap/design-tokens`, which only
 * resolves via a Nuxt/Vite build-time alias (`nuxt.config.ts`), not a real
 * pnpm dependency - so plain Vitest (no Nuxt test environment wired in,
 * see CLAUDE.md) can't import it directly. This function only needs
 * `EditorPreferences` as a type (erased at compile time), so it stays
 * unit-testable without that dependency.
 *
 * Returns null if nothing in `prefs` referenced the renamed folder, so the
 * caller can skip writing back an unchanged row.
 */
export function rewritePreferencePathsForRename(
  prefs: EditorPreferences,
  oldFolderPath: string,
  newFolderPath: string
): EditorPreferences | null {
  const oldPrefix = `${oldFolderPath}/`
  const newPrefix = `${newFolderPath}/`
  let changed = false

  function rewritePath(path: string): string {
    if (path === oldFolderPath) {
      changed = true
      return newFolderPath
    }
    if (path.startsWith(oldPrefix)) {
      changed = true
      return newPrefix + path.slice(oldPrefix.length)
    }
    return path
  }

  const favorites = prefs.favorites.map(rewritePath)
  const expandedFolders = prefs.expandedFolders.map(rewritePath)
  const folderColors = Object.fromEntries(
    Object.entries(prefs.folderColors).map(([path, color]) => [rewritePath(path), color])
  )

  if (!changed) return null

  return { ...prefs, favorites, expandedFolders, folderColors }
}
