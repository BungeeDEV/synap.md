import { test as setup, expect } from '@playwright/test'
import { ADMIN, authFile, goto } from './helpers'

// Runs once before every other spec (it's the "setup" project the others
// depend on). Doubles as the first-run coverage: on a wiped vault the app has
// no admin, so `/` redirects to /setup until this creates one. The resulting
// authenticated session is saved to storageState and reused by all specs.
setup('first-run setup creates the admin account', async ({ page }) => {
  await goto(page, '/setup')
  await page.getByLabel('Benutzername').fill(ADMIN.username)
  await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password)
  await page.getByLabel('Passwort bestätigen').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Konto erstellen' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })

  await page.context().storageState({ path: authFile })
})
