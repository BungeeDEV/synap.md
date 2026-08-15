import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
// Auto-imports would work for broadcastVaultEvent but explicit imports avoid edge-cases
import { broadcastVaultEvent } from './sse'

export async function writeVaultFile(
  db: Database.Database,
  vaultRoot: string,
  relativePath: string,
  content: string,
  expectedMtimeIso?: string
): Promise<{ path: string; mtime: string; hash: string }> {
  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(relativePath, vaultRoot)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  if (typeof expectedMtimeIso === 'string') {
    let existing: Awaited<ReturnType<typeof stat>> | null
    try {
      existing = await stat(absolutePath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        existing = null
      } else {
        throw createError({ statusCode: 500, statusMessage: 'Failed to check existing file state' })
      }
    }

    if (existing && existing.mtime.toISOString() !== expectedMtimeIso) {
      const currentContent = await readFile(absolutePath, 'utf-8')
      throw createError({
        statusCode: 409,
        statusMessage: 'File was modified on disk since it was last loaded',
        data: { currentContent, currentMtime: existing.mtime.toISOString() }
      })
    }
  }

  try {
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content, 'utf-8')

    if (relativePath.toLowerCase().endsWith('.md') && !isInSpecialFolder(relativePath)) {
      await indexNote(db, relativePath, vaultRoot)
    }

    const { mtime } = await stat(absolutePath)
    const hash = createHash('sha256').update(content).digest('hex')
    
    broadcastVaultEvent('file_updated', { path: relativePath })
    
    return { path: relativePath, mtime: mtime.toISOString(), hash }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    if (isInvalidPathSyntaxError(err)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid file name' })
    }
    console.error('[writeVaultFile error]:', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to write file', data: String(err) })
  }
}
