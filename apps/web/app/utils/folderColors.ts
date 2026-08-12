export interface FolderColorOption { key: string, textClass: string, bgClass: string }

// Tailwind's built-in default palette (not arbitrary values, per
// STYLEGUIDE.md) - the same 6 colors VaultTree.vue's hash-based default
// already cycles through, now also user-selectable per folder via the
// "Farbe ändern" context-menu submenu.
export const FOLDER_COLOR_OPTIONS: FolderColorOption[] = [
  { key: 'orange', textClass: 'text-orange-400', bgClass: 'bg-orange-400' },
  { key: 'emerald', textClass: 'text-emerald-400', bgClass: 'bg-emerald-400' },
  { key: 'sky', textClass: 'text-sky-400', bgClass: 'bg-sky-400' },
  { key: 'violet', textClass: 'text-violet-400', bgClass: 'bg-violet-400' },
  { key: 'amber', textClass: 'text-amber-400', bgClass: 'bg-amber-400' },
  { key: 'rose', textClass: 'text-rose-400', bgClass: 'bg-rose-400' }
]

/** Explicit override (if set and valid) wins; otherwise falls back to the deterministic path hash, same algorithm as before per-folder colors existed. */
export function folderColorTextClass(path: string, overrideKey: string | undefined): string {
  if (overrideKey) {
    const found = FOLDER_COLOR_OPTIONS.find((option) => option.key === overrideKey)
    if (found) return found.textClass
  }
  let hash = 0
  for (let i = 0; i < path.length; i++) hash = (hash * 31 + path.charCodeAt(i)) | 0
  return FOLDER_COLOR_OPTIONS[Math.abs(hash) % FOLDER_COLOR_OPTIONS.length]!.textClass
}
