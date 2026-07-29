import { stat } from 'node:fs/promises'
import type { ImportConflictAction } from '../../shared/import'
import { resolveVaultPath } from './vault-path'

export interface NormalizedImport {
  content: string
}

export interface NormalizeImportError {
  error: string
}

/**
 * UTF-8 decodes an uploaded file's raw bytes, strips a leading BOM, and
 * normalizes CRLF/CR line endings to LF - same encoding the rest of the app
 * already assumes (file.put.ts writes plain '\n'-delimited strings). A raw
 * NUL byte is the cheapest reliable "this isn't text" signal (real UTF-8
 * Markdown never contains one) - good enough to catch a renamed binary
 * without pulling in a file-type-sniffing dependency for one heuristic.
 */
export function normalizeImportedContent(raw: Buffer): NormalizedImport | NormalizeImportError {
  if (raw.includes(0)) {
    return { error: 'Datei enthält keinen gültigen Text (Binärformat?)' }
  }

  let text = raw.toString('utf-8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  return { content: text }
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath)
    return true
  } catch {
    return false
  }
}

export type ResolvedImportTarget = { path: string } | { skipped: true }

/**
 * Decides the final vault-relative path for one imported file, applying the
 * chosen conflict strategy against what's actually on disk right now (the
 * client's tree snapshot can be stale, so this - not the dialog's preview -
 * is the authoritative check).
 */
export async function resolveImportTargetPath(
  vaultRoot: string,
  targetFolder: string,
  baseName: string,
  onConflict: ImportConflictAction
): Promise<ResolvedImportTarget> {
  const candidate = targetFolder ? `${targetFolder}/${baseName}.md` : `${baseName}.md`
  const exists = await pathExists(resolveVaultPath(candidate, vaultRoot))

  if (!exists) return { path: candidate }
  if (onConflict === 'skip') return { skipped: true }
  if (onConflict === 'replace') return { path: candidate }

  let suffix = 2
  for (;;) {
    const suffixed = targetFolder ? `${targetFolder}/${baseName} (${suffix}).md` : `${baseName} (${suffix}).md`
    if (!await pathExists(resolveVaultPath(suffixed, vaultRoot))) return { path: suffixed }
    suffix++
  }
}
