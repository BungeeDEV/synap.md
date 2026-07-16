import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

interface VaultStats {
  noteCount: number
  folderCount: number
  attachmentCount: number
  attachmentSizeBytes: number
  totalSizeBytes: number
}

/** Walks the vault tree excluding special folders (_attachments, _trash), counting notes/folders. */
async function walkNotes(absDir: string, stats: VaultStats): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.') || SPECIAL_FOLDERS.includes(entry.name as (typeof SPECIAL_FOLDERS)[number])) continue

    const absPath = join(absDir, entry.name)

    if (entry.isDirectory()) {
      stats.folderCount++
      await walkNotes(absPath, stats)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const { size } = await stat(absPath)
      stats.noteCount++
      stats.totalSizeBytes += size
    }
  }
}

/** Walks _attachments recursively, counting every file in it regardless of nesting. */
async function walkAttachments(absDir: string, stats: VaultStats): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true })

  for (const entry of entries) {
    const absPath = join(absDir, entry.name)

    if (entry.isDirectory()) {
      await walkAttachments(absPath, stats)
    } else if (entry.isFile()) {
      const { size } = await stat(absPath)
      stats.attachmentCount++
      stats.attachmentSizeBytes += size
      stats.totalSizeBytes += size
    }
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const vaultRoot = resolveVaultPath('.', config.vaultPath)

  const stats: VaultStats = { noteCount: 0, folderCount: 0, attachmentCount: 0, attachmentSizeBytes: 0, totalSizeBytes: 0 }

  try {
    await walkNotes(vaultRoot, stats)

    const attachmentsDir = resolveVaultPath(ATTACHMENTS_DIR, config.vaultPath)
    await walkAttachments(attachmentsDir, stats).catch((err) => {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Vault directory not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to compute vault stats' })
  }

  return stats
})
