import { access, mkdir } from 'node:fs/promises'

interface FolderPostBody {
  path: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<FolderPostBody>(event)

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

  const alreadyExists = await access(absolutePath).then(() => true).catch(() => false)
  if (alreadyExists) {
    throw createError({ statusCode: 409, statusMessage: 'Folder already exists' })
  }

  try {
    await mkdir(absolutePath, { recursive: true })
  } catch (err) {
    if (isInvalidPathSyntaxError(err)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder name' })
    }
    console.error('folder.post.ts: failed to create folder at', absolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create folder' })
  }

  return { path: body.path, created: true }
})
