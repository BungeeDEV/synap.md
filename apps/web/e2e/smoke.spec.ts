import { test, expect, type Page } from '@playwright/test'

// The dev server occasionally aborts a navigation mid-flight while it's still
// compiling chunks on demand (net::ERR_ABORTED). Retry a couple of times —
// this is a dev-mode-only wrinkle, not something a user hits against a build.
async function goto(page: Page, path: string) {
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

// One end-to-end journey through the critical paths, run in order in a single
// browser context so state (the freshly-created admin session, the seeded
// note) carries between steps. This is the foundation smoke test — add
// focused specs alongside it for individual features rather than growing this
// one. UI text is asserted in German (the default locale, see
// packages/i18n/src/index.ts).
//
// ponytail: note creation and deletion here go through the API, not the
// inline tree-edit / swipe UI — those are driven via page.request so the
// journey stays robust without threading selectors through VaultTree.vue
// (1300+ lines, no test hooks yet). Add UI-level tree tests + data-testid
// hooks when that interaction itself is what's under test.

const NOTE_PATH = 'e2e-seed-note.md'
const SEED = '# Hello from E2E\n\nseed content'
const EDIT_MARKER = 'EDITED_E2E_MARKER'
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test('first-run setup → note lifecycle → search → re-login', async ({ page }) => {
  await test.step('first-run setup creates the admin and lands on the app', async () => {
    // Dev-server cold start compiles on demand — the goto helper waits for the
    // client bundle to hydrate, or the form submits natively (URL → /setup?).
    await goto(page, '/setup')
    await page.getByLabel('Benutzername').fill('admin')
    await page.getByLabel('Passwort', { exact: true }).fill('supersecret')
    await page.getByLabel('Passwort bestätigen').fill('supersecret')
    await page.getByRole('button', { name: 'Konto erstellen' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })
  })

  await test.step('a note created via the API shows up and opens in the editor', async () => {
    const res = await page.request.put('/api/vault/file', {
      data: { path: NOTE_PATH, content: SEED }
    })
    expect(res.ok()).toBe(true)

    await goto(page, '/')
    await page.getByText('e2e-seed-note').first().click()
    await expect(page.locator('.ProseMirror')).toContainText('Hello from E2E')
  })

  await test.step('editing the note autosaves back to the vault', async () => {
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.press(`${mod}+End`)
    await page.keyboard.type(` ${EDIT_MARKER}`)

    // Autosave is debounced — poll the vault via the API until it lands.
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/vault/file?path=${encodeURIComponent(NOTE_PATH)}`)
        return (await r.json()).content as string
      }, { timeout: 10_000 })
      .toContain(EDIT_MARKER)
  })

  await test.step('the note is findable through the command palette', async () => {
    await page.keyboard.press(`${mod}+k`)
    const palette = page.locator('div.fixed.inset-0.z-50').last()
    const input = palette.getByPlaceholder('Notizen durchsuchen…')
    await expect(input).toBeVisible()
    await input.fill('e2e-seed')
    await expect(palette.getByRole('button', { name: /e2e-seed-note/ }).first()).toBeVisible()
    await page.keyboard.press('Escape')
  })

  await test.step('logout redirects to login, and the admin can sign back in', async () => {
    await page.request.post('/api/auth/logout')
    await goto(page, '/')
    await expect(page).toHaveURL('/login')

    await page.getByLabel('Benutzername').fill('admin')
    await page.getByLabel('Passwort', { exact: true }).fill('supersecret')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/')
  })
})
