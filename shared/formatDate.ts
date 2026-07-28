const TOKEN_RE = /YYYY|MM|DD|HH|mm/g

/**
 * Minimal token-based date formatter (YYYY, MM, DD, HH, mm) - covers daily
 * note naming and template variables without pulling in a date library, per
 * the project's minimal-dependencies line. No locale/timezone handling:
 * always formats using the local system time. Lives in shared/ (not
 * server/utils/) because the settings UI needs the identical formatting for
 * its live date-format preview.
 */
export function formatDate(date: Date, format: string): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes())
  }
  return format.replace(TOKEN_RE, (token) => tokens[token]!)
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Coarse relative-time label for the document header's "zuletzt bearbeitet"
 * meta line ("gerade eben", "vor 5 Minuten", "vor 3 Stunden", "vor 2 Tagen").
 * Falls back to formatDate()'s absolute YYYY-MM-DD beyond 6 days, since
 * "vor 3 Wochen" gets imprecise fast and this app has no i18n/relative-time
 * library dependency to reach for instead.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime())
  if (diffMs < MINUTE_MS) return 'gerade eben'
  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`
  }
  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`
  }
  const days = Math.floor(diffMs / DAY_MS)
  if (days < 7) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
  return formatDate(date, 'YYYY-MM-DD')
}
