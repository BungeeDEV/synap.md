import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { authFile } from './e2e/helpers'

// Isolated throwaway vault + SQLite index so E2E never touches a real vault
// and every run starts from a known-empty state (see e2e/global-setup.ts,
// which wipes this dir before the run).
const tmpDir = fileURLToPath(new URL('./e2e/.tmp', import.meta.url))
// Dedicated port so E2E never reuses a normal `pnpm dev` server that's
// pointed at your real vault.
const PORT = 3100
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // ponytail: one worker, no parallelism — the server owns a single shared
  // vault/SQLite, so parallel specs would race the same files. Split into
  // per-worker vaults only if the suite gets slow enough to need it.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry'
  },
  projects: [
    // Creates the admin once and saves its session; every other spec starts
    // authenticated via storageState. See e2e/auth.setup.ts.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: authFile },
      dependencies: ['setup']
    }
  ],
  webServer: {
    // Locally: dev server, fastest loop. In CI: run the production build (the
    // job builds synap-md first) — representative and free of dev-mode
    // on-demand-compilation flakiness.
    command: isCI ? 'node .output/server/index.mjs' : 'pnpm dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    // Generous: a cold `.nuxt` dev build (Vite + Nitro) can take well over a
    // minute on first run. The CI production server starts far faster.
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      NUXT_VAULT_PATH: `${tmpDir}/vault`,
      NUXT_DATA_PATH: `${tmpDir}/app.db`,
      NUXT_SESSION_PASSWORD: 'e2e-session-password-at-least-32-chars-long'
    }
  }
})
