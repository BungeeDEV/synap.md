// eslint-disable-next-line no-control-regex -- deliberately blocking raw control chars in filenames, not a regex typo
const INVALID_NAME_CHARS_RE = /[<>:"\\|?*\x00-\x1f]/

/** Shared by the vault tree's inline create/rename and the templates settings tab's inline create. */
export function validateRawName(rawValue: string): string | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return 'Name darf nicht leer sein'
  if (trimmed.includes('/')) return 'Name darf kein "/" enthalten'
  if (INVALID_NAME_CHARS_RE.test(trimmed)) return 'Name enthält ungültige Zeichen'
  return null
}
