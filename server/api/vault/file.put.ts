import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

interface FilePutBody {
  path: string
  content: string
  lastKnownMtime?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<FilePutBody>(event)

  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }
  if (typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '"content" must be a string' })
  }

  const config = useRuntimeConfig(event)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(body.path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  if (typeof body.lastKnownMtime === 'string') {
    // A brand-new note has no file on disk yet - stat() rejects with ENOENT,
    // which just means "nothing to conflict with", not an error.
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

    if (existing && existing.mtime.toISOString() !== body.lastKnownMtime) {
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
    await writeFile(absolutePath, body.content, 'utf-8')

    // Templates (and any other special folder) are opened/saved through this
    // same route when a user edits one from the settings tab, but must never
    // enter the search index - listMarkdownFiles()/reindex already exclude
    // them, so a save-triggered index here would silently drift from what a
    // full reindex produces.
    if (body.path.toLowerCase().endsWith('.md') && !isInSpecialFolder(body.path)) {
      await indexNote(getDb(), body.path, config.vaultPath)
    }

    const { mtime } = await stat(absolutePath)
    return { path: body.path, mtime: mtime.toISOString() }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    if (isInvalidPathSyntaxError(err)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid file name' })
    }
    console.error('file.put.ts: failed to write file at', absolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to write file' })
  }
})
