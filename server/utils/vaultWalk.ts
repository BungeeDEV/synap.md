import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { SPECIAL_FOLDERS } from './specialFolders'

export interface FolderWalkStats {
  noteCount: number
  folderCount: number
  totalSizeBytes: number
}

/**
 * Recursively walks a vault-relative directory, counting `.md` notes and
 * subfolders (excluding SPECIAL_FOLDERS/dotfiles) - shared by
 * vault-stats.get.ts (walks the whole vault root) and folder-stats.get.ts
 * (walks a single arbitrary folder). Uses explicit imports rather than
 * Nitro's cross-file auto-import, matching vault-path.ts/indexer.ts's
 * exception (see STYLEGUIDE.md), since it's a candidate for direct Vitest
 * unit testing.
 */
export async function walkFolderStats(absDir: string, stats: FolderWalkStats = { noteCount: 0, folderCount: 0, totalSizeBytes: 0 }): Promise<FolderWalkStats> {
  const entries = await readdir(absDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.') || SPECIAL_FOLDERS.includes(entry.name as (typeof SPECIAL_FOLDERS)[number])) continue

    const absPath = join(absDir, entry.name)

    if (entry.isDirectory()) {
      stats.folderCount++
      await walkFolderStats(absPath, stats)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const { size } = await stat(absPath)
      stats.noteCount++
      stats.totalSizeBytes += size
    }
  }

  return stats
}
