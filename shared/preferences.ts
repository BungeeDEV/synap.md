export interface DailyNotesPreferences {
  folder: string
  dateFormat: string
  templateName: string | null
}

export interface EditorPreferences {
  defaultViewMode: 'code' | 'split' | 'reader' | 'live'
  editorFontSize: number
  lineWrap: boolean
  dailyNotes: DailyNotesPreferences
}

export const DEFAULT_PREFERENCES: EditorPreferences = {
  defaultViewMode: 'code',
  editorFontSize: 14,
  lineWrap: true,
  dailyNotes: {
    folder: 'Tagesplanung',
    dateFormat: 'YYYY-MM-DD',
    templateName: null
  }
}
