import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Isolated throwaway vault + SQLite index so E2E never touches a real vault
// and every run starts from a known-empty state (see e2e/global-setup.ts,
// which wipes this dir before the run).
const tmpDir = fileURLToPath(new URL('./e2e/.tmp', import.meta.url))
// Dedicated port so E2E never reuses a normal `pnpm dev` server that's
// pointed at your real vault.
const PORT = 3100

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // ponytail: one worker, no parallelism — the server owns a single shared
  // vault/SQLite, so parallel specs would race the same files. Split into
  // per-worker vaults only if the suite gets slow enough to need it.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // ponytail: dev server, not a prod build — fastest local loop. For CI,
    // swap to `pnpm build && node .output/server/index.mjs` if dev-mode
    // on-demand compilation makes the first navigation flaky.
    command: 'pnpm dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NUXT_VAULT_PATH: `${tmpDir}/vault`,
      NUXT_DATA_PATH: `${tmpDir}/app.db`,
      NUXT_SESSION_PASSWORD: 'e2e-session-password-at-least-32-chars-long'
    }
  }
})
