import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'

interface DuplicatePostBody {
  path: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DuplicatePostBody>(event)

  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }

  const config = useRuntimeConfig(event)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(body.path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  const ext = extname(body.path)
  const rawDir = dirname(body.path)
  const dir = rawDir === '.' ? '' : rawDir
  const base = basename(body.path, ext)

  async function candidatePathExists(relativePath: string): Promise<boolean> {
    try {
      await access(resolveVaultPath(relativePath, config.vaultPath))
      return true
    } catch {
      return false
    }
  }

  // "Name (Kopie).md", then "Name (Kopie 2).md", "Name (Kopie 3).md", ... -
  // same collision-avoidance idea rename.post.ts's 409 forces the client to
  // resolve manually, except duplicate has no user-entered name to collide
  // with, so it resolves the collision itself instead of failing.
  let candidateName = `${base} (Kopie)${ext}`
  let attempt = 2
  let newPath = dir ? `${dir}/${candidateName}` : candidateName
  while (await candidatePathExists(newPath)) {
    candidateName = `${base} (Kopie ${attempt})${ext}`
    newPath = dir ? `${dir}/${candidateName}` : candidateName
    attempt++
  }

  const newAbsolutePath = resolveVaultPath(newPath, config.vaultPath)

  try {
    const content = await readFile(absolutePath, 'utf-8')
    await mkdir(dirname(newAbsolutePath), { recursive: true })
    await writeFile(newAbsolutePath, content, 'utf-8')

    if (newPath.toLowerCase().endsWith('.md') && !isInSpecialFolder(newPath)) {
      await indexNote(getDb(), newPath, config.vaultPath)
    }

    const { mtime } = await stat(newAbsolutePath)
    return { path: newPath, mtime: mtime.toISOString() }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }
    console.error('duplicate.post.ts: failed to duplicate', absolutePath, '->', newAbsolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to duplicate file' })
  }
})
