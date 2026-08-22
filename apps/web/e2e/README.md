# E2E tests

Playwright end-to-end tests for the web app. Complements the server-side unit
tests in `server/utils/*.test.ts` — this layer exercises real user journeys
through the browser.

## Run

```bash
pnpm --filter synap-md test:e2e      # headless
pnpm --filter synap-md test:e2e:ui   # Playwright UI mode (watch/debug)
```

First checkout only: `pnpm --filter synap-md exec playwright install chromium`.

Playwright boots its own server on **port 3100** (so it never collides with a
normal `pnpm dev` on 3000) against a **throwaway vault + SQLite index** under
`e2e/.tmp/`. `global-setup.ts` wipes that dir before each run, so state is
deterministic and your real vault is never touched. Locally it uses `pnpm dev`;
in CI it runs the production build (`node .output/server/index.mjs`).

## Structure

- `auth.setup.ts` — a Playwright *setup project*: performs first-run admin
  setup (that's the first-run coverage) and saves the session to
  `e2e/.auth/user.json`. Every other spec depends on it and starts already
  authenticated via `storageState`, so specs don't each re-login.
- `helpers.ts` — shared `goto` (retries dev-server navigation aborts + waits
  for hydration), `seedNote` (creates a note via the API), credentials, the
  platform modifier key, and the `storageState` path.
- `*.spec.ts` — one focused spec per area (`auth`, `notes`, `search`).

## Extend

- Add a new `*.spec.ts` per feature — don't grow existing ones.
- Specs run single-worker against one shared vault. Give each spec its own
  uniquely-named notes (seed via `seedNote`) so they don't collide.
- UI text is asserted in **German** (default locale). Prefer role/label
  selectors over CSS.
- No `data-testid` hooks exist yet. When a test needs to drive the file tree's
  inline create/rename/swipe UI, add hooks there rather than fighting the DOM;
  until then, set up file state via `seedNote`.
- Trash/templates *logic* is covered by unit tests (`server/utils/*.test.ts`);
  E2E here focuses on the interactive UI journeys, not API round-trips.
