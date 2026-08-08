import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

interface VaultStats extends FolderWalkStats {
  attachmentCount: number
  attachmentSizeBytes: number
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
    await walkFolderStats(vaultRoot, stats)

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
