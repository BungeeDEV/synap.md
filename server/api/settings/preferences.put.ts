import type { EditorPreferences } from '#shared/preferences'

interface DailyNotesPutBody {
  folder?: unknown
  dateFormat?: unknown
  templateName?: unknown
}

interface PreferencesPutBody {
  defaultViewMode?: unknown
  editorFontSize?: unknown
  dailyNotes?: DailyNotesPutBody
  favorites?: unknown
  expandedFolders?: unknown
}

const VIEW_MODES = ['editor', 'reader']

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody<PreferencesPutBody>(event)

  if (body?.defaultViewMode !== undefined && !VIEW_MODES.includes(body.defaultViewMode as string)) {
    throw createError({ statusCode: 400, statusMessage: '"defaultViewMode" must be one of editor, reader' })
  }
  if (body?.editorFontSize !== undefined
    && (typeof body.editorFontSize !== 'number' || body.editorFontSize < 10 || body.editorFontSize > 24)) {
    throw createError({ statusCode: 400, statusMessage: '"editorFontSize" must be a number between 10 and 24' })
  }
  if (body?.dailyNotes?.folder !== undefined
    && (typeof body.dailyNotes.folder !== 'string' || body.dailyNotes.folder.trim().length === 0)) {
    throw createError({ statusCode: 400, statusMessage: '"dailyNotes.folder" must be a non-empty string' })
  }
  if (body?.dailyNotes?.dateFormat !== undefined
    && (typeof body.dailyNotes.dateFormat !== 'string' || body.dailyNotes.dateFormat.trim().length === 0)) {
    throw createError({ statusCode: 400, statusMessage: '"dailyNotes.dateFormat" must be a non-empty string' })
  }
  if (body?.dailyNotes?.templateName !== undefined
    && body.dailyNotes.templateName !== null && typeof body.dailyNotes.templateName !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '"dailyNotes.templateName" must be a string or null' })
  }
  if (body?.favorites !== undefined && !isStringArray(body.favorites)) {
    throw createError({ statusCode: 400, statusMessage: '"favorites" must be an array of strings' })
  }
  if (body?.expandedFolders !== undefined && !isStringArray(body.expandedFolders)) {
    throw createError({ statusCode: 400, statusMessage: '"expandedFolders" must be an array of strings' })
  }

  const db = getDb()
  const row = db.prepare('SELECT preferences_json FROM users WHERE id = ?').get(user.id) as { preferences_json: string } | undefined
  const current = parsePreferences(row?.preferences_json ?? '{}')

  const merged: EditorPreferences = {
    ...current,
    ...(body.defaultViewMode !== undefined && { defaultViewMode: body.defaultViewMode as EditorPreferences['defaultViewMode'] }),
    ...(body.editorFontSize !== undefined && { editorFontSize: body.editorFontSize as number }),
    ...(body.dailyNotes !== undefined && {
      dailyNotes: {
        ...current.dailyNotes,
        ...(body.dailyNotes.folder !== undefined && { folder: (body.dailyNotes.folder as string).trim() }),
        ...(body.dailyNotes.dateFormat !== undefined && { dateFormat: (body.dailyNotes.dateFormat as string).trim() }),
        ...(body.dailyNotes.templateName !== undefined && { templateName: body.dailyNotes.templateName as string | null })
      }
    }),
    ...(body.favorites !== undefined && { favorites: body.favorites as string[] }),
    ...(body.expandedFolders !== undefined && { expandedFolders: body.expandedFolders as string[] })
  }

  db.prepare('UPDATE users SET preferences_json = ? WHERE id = ?').run(JSON.stringify(merged), user.id)

  return merged
})
