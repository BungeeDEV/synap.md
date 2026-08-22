import { test, expect } from '@playwright/test'
import { ADMIN, goto } from './helpers'

test('logout redirects to login, and the admin can sign back in', async ({ page }) => {
  await page.request.post('/api/auth/logout')
  await goto(page, '/')
  await expect(page).toHaveURL('/login')

  await page.getByLabel('Benutzername').fill(ADMIN.username)
  await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })
})

test('protected API rejects an unauthenticated request', async ({ page }) => {
  await page.request.post('/api/auth/logout')
  const res = await page.request.get('/api/vault/tree')
  expect(res.status()).toBe(401)
})
