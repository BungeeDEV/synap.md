import { unlink } from 'node:fs/promises'

interface DeleteTemplateBody {
  path: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DeleteTemplateBody>(event)

  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }
  // Defense in depth: this route only ever deletes template files, never
  // an arbitrary vault path, regardless of what the client sends.
  if (!body.path.startsWith(`${TEMPLATES_DIR}/`)) {
    throw createError({ statusCode: 400, statusMessage: 'Path must be inside _templates/' })
  }

  const config = useRuntimeConfig(event)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(body.path, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    await unlink(absolutePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Vorlage konnte nicht gelöscht werden' })
  }

  return { path: body.path, deleted: true }
})
