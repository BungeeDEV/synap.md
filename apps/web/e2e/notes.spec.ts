import { test, expect } from '@playwright/test'
import { goto, mod, seedNote } from './helpers'

const NOTE = 'e2e-notes.md'
const EDIT_MARKER = 'EDITED_E2E_MARKER'

test('a seeded note opens in the editor and edits autosave to the vault', async ({ page }) => {
  await seedNote(page.request, NOTE, '# Hello from E2E\n\nseed content')

  await goto(page, '/')
  await page.getByText('e2e-notes').first().click()
  const editor = page.locator('.ProseMirror')
  await expect(editor).toContainText('Hello from E2E')

  await editor.click()
  await page.keyboard.press(`${mod}+End`)
  await page.keyboard.type(` ${EDIT_MARKER}`)

  // Autosave is debounced — poll the vault via the API until the edit lands.
  await expect
    .poll(async () => {
      const r = await page.request.get(`/api/vault/file?path=${encodeURIComponent(NOTE)}`)
      return (await r.json()).content as string
    }, { timeout: 10_000 })
    .toContain(EDIT_MARKER)
})
