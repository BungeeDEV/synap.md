import { fileURLToPath } from 'node:url'
import type { APIRequestContext, Page } from '@playwright/test'

// Shared across the setup project (writes it) and the config (reads it back
// as storageState) so every spec starts already authenticated.
export const authFile = fileURLToPath(new URL('./.auth/user.json', import.meta.url))

export const ADMIN = { username: 'admin', password: 'supersecret' } as const

// Cmd on macOS, Ctrl elsewhere (CI is Linux). The browser reports the same
// platform as the process, so this matches what useGlobalHotkeys checks.
export const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

// The dev server occasionally aborts a navigation while compiling chunks on
// demand (net::ERR_ABORTED), and cold starts render before the client bundle
// hydrates. Retry, and always wait for the network to settle so interactions
// don't hit a not-yet-hydrated form (which would submit natively).
export async function goto(page: Page, path: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      return
    } catch (err) {
      if (attempt >= 2) throw err
    }
  }
}

// Create a note straight through the API (shares the browser context's auth
// cookie). Keeps specs that aren't about note *creation* from depending on the
// file tree's inline-edit UI.
export async function seedNote(request: APIRequestContext, path: string, content: string) {
  const res = await request.put('/api/vault/file', { data: { path, content } })
  if (!res.ok()) throw new Error(`seedNote(${path}) failed: ${res.status()}`)
}
