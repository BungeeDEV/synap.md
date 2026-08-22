import { test, expect } from '@playwright/test'
import { goto, mod, seedNote } from './helpers'

test('the command palette finds a note by name', async ({ page }) => {
  await seedNote(page.request, 'e2e-search.md', '# Searchable\n\nfindable content')
  await goto(page, '/')

  await page.keyboard.press(`${mod}+k`)
  const palette = page.locator('div.fixed.inset-0.z-50').last()
  const input = palette.getByPlaceholder('Notizen durchsuchen…')
  await expect(input).toBeVisible()

  await input.fill('e2e-search')
  await expect(palette.getByRole('button', { name: /e2e-search/ }).first()).toBeVisible()
})
