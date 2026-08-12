export interface DailyNotesPreferences {
  folder: string
  dateFormat: string
  templateName: string | null
}

export interface EditorPreferences {
  defaultViewMode: 'editor' | 'reader'
  editorFontSize: number
  dailyNotes: DailyNotesPreferences
  // Vault-relative file paths, independent of folder location - the
  // sidebar's Favoriten section lists these flat, unlike the tree view.
  favorites: string[]
  // Vault-relative folder paths currently expanded in the sidebar tree,
  // synced (debounced) so it's the same across devices/browsers - see
  // vaultTree.ts.
  expandedFolders: string[]
  // Vault-relative folder path -> FOLDER_COLOR_OPTIONS key (app/utils/folderColors.ts).
  // Only holds explicit user overrides - a folder with no entry here still
  // gets a color, just the deterministic hash-based default.
  folderColors: Record<string, string>
}

export const DEFAULT_PREFERENCES: EditorPreferences = {
  defaultViewMode: 'editor',
  editorFontSize: 14,
  dailyNotes: {
    folder: 'Tagesplanung',
    dateFormat: 'YYYY-MM-DD',
    templateName: null
  },
  favorites: [],
  expandedFolders: [],
  folderColors: {}
}
