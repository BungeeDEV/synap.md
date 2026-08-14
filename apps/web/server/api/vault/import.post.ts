import { mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import { isMarkdownImportFilename } from '#shared/import'
import { validateRawName } from '#shared/validateFileName'

// 50MB is well above any realistic Markdown note - not the same knob as the
// soft "large file" hint the import dialog shows at 5MB (that's a warning,
// not a block, per spec). This is purely an abuse backstop so an import
// endpoint can't be used to smuggle in an arbitrarily large upload.
const MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const filePart = form?.find((part) => part.name === 'file')
  const targetFolder = form?.find((part) => part.name === 'targetFolder')?.data.toString('utf-8') ?? ''
  const onConflict = form?.find((part) => part.name === 'onConflict')?.data.toString('utf-8')

  if (!filePart || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: '"file" is required' })
  }
  if (onConflict !== 'skip' && onConflict !== 'replace' && onConflict !== 'keep-both') {
    throw createError({ statusCode: 400, statusMessage: '"onConflict" must be "skip", "replace" or "keep-both"' })
  }

  const config = useRuntimeConfig(event)

  // Empty string is a valid target (vault root) - only non-empty targets get
  // path-validated, same "'' means root" convention vaultTree.selectedFolder
  // already uses client-side.
  let targetAbsolute: string
  try {
    targetAbsolute = targetFolder ? resolveVaultPath(targetFolder, config.vaultPath) : resolveVaultPath('.', config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid target folder' })
  }

  let targetStats: Awaited<ReturnType<typeof stat>>
  try {
    targetStats = await stat(targetAbsolute)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Target folder does not exist' })
  }
  if (!targetStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Target is not a folder' })
  }
  if (isInSpecialFolder(targetFolder)) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot import into a reserved folder' })
  }

  if (!isMarkdownImportFilename(filePart.filename)) {
    throw createError({ statusCode: 415, statusMessage: 'Nur .md/.markdown-Dateien können importiert werden' })
  }
  if (filePart.data.length > MAX_IMPORT_SIZE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Datei ist zu groß' })
  }

  const baseName = basename(filePart.filename, extname(filePart.filename))
  const nameError = validateRawName(baseName)
  if (nameError) {
    throw createError({ statusCode: 400, statusMessage: nameError })
  }

  const normalized = normalizeImportedContent(filePart.data)
  if ('error' in normalized) {
    throw createError({ statusCode: 415, statusMessage: normalized.error })
  }

  const resolved = await resolveImportTargetPath(config.vaultPath, targetFolder, baseName, onConflict)
  if ('skipped' in resolved) {
    return { path: null, status: 'skipped' as const }
  }

  const absolutePath = resolveVaultPath(resolved.path, config.vaultPath)

  try {
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, normalized.content, 'utf-8')
    await indexNote(getDb(), resolved.path, config.vaultPath)
    return { path: resolved.path, status: 'imported' as const }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('import.post.ts: failed to write imported file at', absolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to write imported file' })
  }
})
