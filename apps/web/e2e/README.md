# E2E tests

Playwright end-to-end tests for the web app. Complements the server-side unit
tests in `server/utils/*.test.ts` — this layer exercises real user journeys
through the browser.

## Run

```bash
pnpm --filter synap-md test:e2e      # headless
pnpm --filter synap-md test:e2e:ui   # Playwright UI mode (watch/debug)
```

Playwright boots its own dev server on **port 3100** (so it never collides
with a normal `pnpm dev` on 3000) against a **throwaway vault + SQLite index**
under `e2e/.tmp/`. `global-setup.ts` wipes that dir before each run, so the
first-run setup flow is deterministic and your real vault is never touched.

First checkout only: `pnpm --filter synap-md exec playwright install chromium`.

## Extend

- Add focused specs alongside `smoke.spec.ts` — don't grow the smoke journey.
- Tests run single-worker (the server owns one shared vault). Keep specs
  independent of each other's leftover files, or clean up via the API.
- UI text is asserted in **German** (default locale). Use role/label selectors.
- No `data-testid` hooks exist yet. When a test needs to drive the file tree's
  inline create/rename/swipe UI, add hooks there rather than fighting the DOM.
