import { access, unlink } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type Database from 'better-sqlite3'
import { sanitizeAttachmentFilename } from './attachments'
import { TRASH_DIR } from './specialFolders'
import { resolveVaultPath } from './vault-path'

/**
 * Builds a collision-safe relative path inside _trash/ for a file about to
 * be soft-deleted, reusing attachments.ts's timestamp-prefix + sanitized-name
 * scheme rather than inventing a second one.
 */
export async function buildTrashedPath(originalRelativePath: string, vaultRoot: string): Promise<string> {
  let candidateName = sanitizeAttachmentFilename(basename(originalRelativePath))

  let suffix = 0
  while (await access(resolveVaultPath(`${TRASH_DIR}/${candidateName}`, vaultRoot)).then(() => true).catch(() => false)) {
    suffix++
    const ext = extname(candidateName)
    candidateName = `${candidateName.slice(0, candidateName.length - ext.length)}-${suffix}${ext}`
  }

  return `${TRASH_DIR}/${candidateName}`
}

/**
 * Permanently deletes every trash row (and its underlying file) older than
 * retentionDays. A file already missing on disk is treated as already
 * cleaned up, not an error - the DB row is removed either way.
 */
export async function cleanupExpiredTrash(db: Database.Database, vaultRoot: string, retentionDays: number): Promise<void> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const expired = db.prepare('SELECT id, trashed_path FROM trash WHERE deleted_at < ?').all(cutoff) as
    { id: number, trashed_path: string }[]

  for (const row of expired) {
    try {
      await unlink(resolveVaultPath(row.trashed_path, vaultRoot))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('trash.ts: failed to delete expired trash file', row.trashed_path, err)
        continue
      }
    }
    db.prepare('DELETE FROM trash WHERE id = ?').run(row.id)
  }
}
