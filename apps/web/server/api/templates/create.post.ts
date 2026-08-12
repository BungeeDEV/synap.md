import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

interface CreateTemplateBody {
  name: string
}

// Same validation rules as the tree's inline create/rename flow (see
// app/utils/validateFileName.ts) - deliberately mirrored here rather than
// trusting the client, since this route is reachable directly too.
// eslint-disable-next-line no-control-regex -- deliberately blocking raw control chars in filenames, not a regex typo
const INVALID_NAME_CHARS_RE = /[<>:"\\|?*\x00-\x1f]/

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateTemplateBody>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name darf nicht leer sein' })
  }
  if (name.includes('/')) {
    throw createError({ statusCode: 400, statusMessage: 'Name darf kein "/" enthalten' })
  }
  if (INVALID_NAME_CHARS_RE.test(name)) {
    throw createError({ statusCode: 400, statusMessage: 'Name enthält ungültige Zeichen' })
  }

  const config = useRuntimeConfig(event)
  const relativePath = templateRelativePath(name)

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(relativePath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  const alreadyExists = await access(absolutePath).then(() => true).catch(() => false)
  if (alreadyExists) {
    throw createError({ statusCode: 409, statusMessage: 'Vorlage existiert bereits' })
  }

  try {
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, '', 'utf-8')
  } catch (err) {
    if (isInvalidPathSyntaxError(err)) {
      throw createError({ statusCode: 400, statusMessage: 'Ungültiger Name' })
    }
    console.error('templates/create.post.ts: failed to create template at', absolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Vorlage konnte nicht erstellt werden' })
  }

  return { path: relativePath }
})
