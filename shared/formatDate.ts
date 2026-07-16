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
