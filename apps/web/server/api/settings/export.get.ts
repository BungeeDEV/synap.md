import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ZipArchive } from 'archiver'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const rawPath = getQuery(event).path
  const relativePath = typeof rawPath === 'string' ? rawPath : undefined

  if (rawPath !== undefined && relativePath === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  let scopedRoot: string
  try {
    scopedRoot = resolveVaultPath(relativePath || '.', config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  let entries: Dirent[]
  try {
    entries = await readdir(scopedRoot, { withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Vault directory not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to read vault directory' })
  }

  const dateStamp = new Date().toISOString().slice(0, 10)
  const exportName = relativePath ? relativePath.split('/').pop() : 'vault'
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${exportName}-export-${dateStamp}.zip"`)

  const archive = new ZipArchive({ zlib: { level: 9 } })

  for (const entry of entries) {
    // _trash holds soft-deleted files, deliberately never part of an export -
    // see decisions.md on the vault directory being the source of truth.
    if (entry.name.startsWith('.') || entry.name === TRASH_DIR) continue

    const absPath = join(scopedRoot, entry.name)
    if (entry.isDirectory()) {
      archive.directory(absPath, entry.name)
    } else if (entry.isFile()) {
      archive.file(absPath, { name: entry.name })
    }
  }

  void archive.finalize()

  return sendStream(event, archive)
})
