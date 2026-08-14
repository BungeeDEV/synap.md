import { ATTACHMENTS_DIR } from './attachments'

export const TRASH_DIR = '_trash'
export const TEMPLATES_DIR = '_templates'
export const ARCHIVE_DIR = '_archive'

/** Top-level vault folders excluded from the tree view, the search index, and Markdown file walks. */
export const SPECIAL_FOLDERS = [ATTACHMENTS_DIR, TRASH_DIR, TEMPLATES_DIR, ARCHIVE_DIR] as const

/** True when relativePath's first segment is one of SPECIAL_FOLDERS. */
export function isInSpecialFolder(relativePath: string): boolean {
  const [first] = relativePath.split('/')
  return SPECIAL_FOLDERS.includes(first as (typeof SPECIAL_FOLDERS)[number])
}
