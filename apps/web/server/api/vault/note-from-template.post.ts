interface NoteFromTemplateBody {
  path: string
  templateName?: string | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<NoteFromTemplateBody>(event)

  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '"path" is required' })
  }
  if (body.templateName !== undefined && body.templateName !== null && typeof body.templateName !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '"templateName" must be a string or null' })
  }

  const config = useRuntimeConfig(event)

  try {
    return await createNoteFromTemplate(getDb(), body.path, body.templateName ?? null, config.vaultPath)
  } catch (err) {
    if (err instanceof VaultPathError) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
    }
    if (err instanceof TemplateNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
    }
    if (isInvalidPathSyntaxError(err)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid file name' })
    }
    console.error('note-from-template.post.ts: failed to create note at', body.path, err)
    throw createError({ statusCode: 500, statusMessage: 'Note konnte nicht erstellt werden' })
  }
})
