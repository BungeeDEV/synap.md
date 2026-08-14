/**
 * Opens sanitized note HTML (already rehype-sanitized server-side by
 * render.get.ts) in a new window with a minimal print stylesheet and
 * triggers the browser's print dialog - "Als PDF speichern" is just the
 * OS/browser print target, so this covers both without a server-side PDF
 * dependency (would conflict with the single-lightweight-container
 * self-hosting constraint). Deliberately unstyled relative to the app's
 * dark theme - print output is expected to differ (black on white), not
 * mirror the on-screen theme.
 */
export function printHtmlDocument(title: string, html: string): void {
  const win = window.open('', '_blank')
  if (!win) return

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.6; color: #111; }
  h1, h2, h3, h4 { font-weight: 600; }
  pre, code { font-family: ui-monospace, monospace; }
  pre { background: #f4f4f4; padding: 0.75rem; border-radius: 6px; overflow-x: auto; }
  img { max-width: 100%; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>${html}</body>
</html>`)
  win.document.close()
  win.onload = () => win.print()
}
