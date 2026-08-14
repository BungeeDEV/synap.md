import { access } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { sanitizeAttachmentFilename } from './attachments'
import { ARCHIVE_DIR } from './specialFolders'
import { resolveVaultPath } from './vault-path'

/**
 * Builds a collision-safe relative path inside _archive/ for a file about to
 * be archived, reusing attachments.ts's timestamp-prefix + sanitized-name
 * scheme rather than inventing a second one (same approach as trash.ts's
 * buildTrashedPath).
 */
export async function buildArchivedPath(originalRelativePath: string, vaultRoot: string): Promise<string> {
  let candidateName = sanitizeAttachmentFilename(basename(originalRelativePath))

  let suffix = 0
  while (await access(resolveVaultPath(`${ARCHIVE_DIR}/${candidateName}`, vaultRoot)).then(() => true).catch(() => false)) {
    suffix++
    const ext = extname(candidateName)
    candidateName = `${candidateName.slice(0, candidateName.length - ext.length)}-${suffix}${ext}`
  }

  return `${ARCHIVE_DIR}/${candidateName}`
}
