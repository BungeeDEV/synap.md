import { access } from 'node:fs/promises'
import { formatDate } from '#shared/formatDate'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const db = getDb()
  const row = db.prepare('SELECT preferences_json FROM users WHERE id = ?').get(user.id) as { preferences_json: string } | undefined
  const { dailyNotes } = parsePreferences(row?.preferences_json ?? '{}')

  const config = useRuntimeConfig(event)
  const relativePath = `${dailyNotes.folder}/${formatDate(new Date(), dailyNotes.dateFormat)}.md`

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(relativePath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid daily note path - check folder/date format in settings' })
  }

  const alreadyExists = await access(absolutePath).then(() => true).catch(() => false)
  if (alreadyExists) {
    return { path: relativePath, created: false }
  }

  try {
    await createNoteFromTemplate(db, relativePath, dailyNotes.templateName, config.vaultPath)
  } catch (err) {
    if (err instanceof VaultPathError) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid daily note path - check folder/date format in settings' })
    }
    // The configured default template can go stale if it's deleted after
    // being selected in settings - surface that clearly rather than a raw 500.
    if (err instanceof TemplateNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'Konfigurierte Vorlage nicht gefunden - bitte in den Einstellungen prüfen' })
    }
    throw err
  }

  return { path: relativePath, created: true }
})
