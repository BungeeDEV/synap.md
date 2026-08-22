import { test, expect } from '@playwright/test'
import { goto, seedNote } from './helpers'

test('the vault health panel reports a clean vault, then a broken wikilink after one is introduced', async ({ page }) => {
  await goto(page, '/settings?tab=health')

  await expect(page.getByRole('heading', { name: 'Vault-Gesundheitscheck' })).toBeVisible()
  await expect(page.getByText('Alles sauber — keine Probleme gefunden.')).toBeVisible({ timeout: 10_000 })

  await seedNote(page.request, 'e2e-health-source.md', 'Links to [[e2e-health-nonexistent-target]].')

  await page.getByRole('button', { name: 'Aktualisieren' }).click()

  const brokenLinkRow = page.getByRole('button', { name: /e2e-health-nonexistent-target/ })
  await expect(brokenLinkRow).toBeVisible({ timeout: 10_000 })

  await brokenLinkRow.click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('.ProseMirror')).toContainText('e2e-health-nonexistent-target')
})
