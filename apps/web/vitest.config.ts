import { defineConfig } from 'vitest/config'

// Vitest's default include pattern (`**/*.{test,spec}.ts`) also matches the
// Playwright specs under e2e/ (*.spec.ts) - excluded here, or `vitest run`
// tries to execute them as unit tests and fails immediately since `test()`
// there comes from @playwright/test, not vitest's global.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**']
  }
})
