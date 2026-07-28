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
  // Vault-relative file paths, independent of folder location - the
  // sidebar's Favoriten section lists these flat, unlike the tree view.
  favorites: string[]
  // Vault-relative folder paths currently expanded in the sidebar tree,
  // synced (debounced) so it's the same across devices/browsers - see
  // vaultTree.ts.
  expandedFolders: string[]
}

export const DEFAULT_PREFERENCES: EditorPreferences = {
  defaultViewMode: 'code',
  editorFontSize: 14,
  lineWrap: true,
  dailyNotes: {
    folder: 'Tagesplanung',
    dateFormat: 'YYYY-MM-DD',
    templateName: null
  },
  favorites: [],
  expandedFolders: []
}
