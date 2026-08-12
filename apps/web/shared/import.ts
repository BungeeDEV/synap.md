/** Shared between the import dialog/upload client and the server route so the two never drift on what counts as importable. */
export const MARKDOWN_IMPORT_EXTENSIONS = ['.md', '.markdown'] as const

export function isMarkdownImportFilename(filename: string): boolean {
  const lower = filename.toLowerCase()
  return MARKDOWN_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** How to handle a filename that already exists in the target folder. */
export type ImportConflictAction = 'skip' | 'replace' | 'keep-both'

export interface ImportFileResult {
  name: string
  path: string | null
  status: 'imported' | 'skipped' | 'cancelled' | 'error'
  error?: string
}
