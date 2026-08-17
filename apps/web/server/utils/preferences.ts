import { DEFAULT_PREFERENCES, type DailyNotesPreferences, type EditorPreferences } from '@synap/store/preferences_types'
import { themeIds } from '@synap/design-tokens'
import { LOCALE_IDS } from '@synap/i18n'

const VIEW_MODES: EditorPreferences['defaultViewMode'][] = ['editor', 'reader']

function parseDailyNotes(raw: unknown): DailyNotesPreferences {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<DailyNotesPreferences>

  return {
    folder: typeof parsed.folder === 'string' && parsed.folder.trim().length > 0
      ? parsed.folder
      : DEFAULT_PREFERENCES.dailyNotes.folder,
    dateFormat: typeof parsed.dateFormat === 'string' && parsed.dateFormat.trim().length > 0
      ? parsed.dateFormat
      : DEFAULT_PREFERENCES.dailyNotes.dateFormat,
    templateName: typeof parsed.templateName === 'string' ? parsed.templateName : null
  }
}

function parseStringArray(raw: unknown, fallback: string[]): string[] {
  return Array.isArray(raw) && raw.every((entry) => typeof entry === 'string') ? raw : fallback
}

function parseStringRecord(raw: unknown, fallback: Record<string, string>): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback
  const entries = Object.entries(raw as Record<string, unknown>)
  return entries.every(([, value]) => typeof value === 'string') ? raw as Record<string, string> : fallback
}

/** Parses a user's stored preferences_json, filling in defaults for any missing/invalid field. */
export function parsePreferences(json: string): EditorPreferences {
  let parsed: Partial<Record<keyof EditorPreferences, unknown>>
  try {
    parsed = JSON.parse(json)
  } catch {
    parsed = {}
  }

  return {
    defaultViewMode: VIEW_MODES.includes(parsed.defaultViewMode as EditorPreferences['defaultViewMode'])
      ? parsed.defaultViewMode as EditorPreferences['defaultViewMode']
      : DEFAULT_PREFERENCES.defaultViewMode,
    editorFontSize: typeof parsed.editorFontSize === 'number' && parsed.editorFontSize >= 10 && parsed.editorFontSize <= 24
      ? parsed.editorFontSize
      : DEFAULT_PREFERENCES.editorFontSize,
    theme: themeIds.includes(parsed.theme as EditorPreferences['theme'])
      ? parsed.theme as EditorPreferences['theme']
      : DEFAULT_PREFERENCES.theme,
    accentColor: typeof parsed.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor)
      ? parsed.accentColor
      : DEFAULT_PREFERENCES.accentColor,
    locale: LOCALE_IDS.includes(parsed.locale as EditorPreferences['locale'])
      ? parsed.locale as EditorPreferences['locale']
      : DEFAULT_PREFERENCES.locale,
    dailyNotes: parseDailyNotes(parsed.dailyNotes),
    favorites: parseStringArray(parsed.favorites, DEFAULT_PREFERENCES.favorites),
    expandedFolders: parseStringArray(parsed.expandedFolders, DEFAULT_PREFERENCES.expandedFolders),
    folderColors: parseStringRecord(parsed.folderColors, DEFAULT_PREFERENCES.folderColors)
  }
}
