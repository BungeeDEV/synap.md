# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@.claude/styles/web/synap-md.md
@.claude/knowledge/web/synap-md/decisions.md
@.claude/knowledge/web/synap-md/components.md

## What this is

synap.md — a self-hosted, Obsidian-like Markdown notes app. The vault (a
directory of `.md` files on disk) is the source of truth; SQLite
(better-sqlite3) is only ever a rebuildable search/index cache, never the
data owner. Single Docker container, single `/data` volume (vault +
SQLite), no external services.

## Commands

```bash
pnpm dev            # start dev server (Nuxt)
pnpm build           # production build
pnpm test            # vitest run (all *.test.ts, one-shot, no watch)
pnpm test -- <path>   # run a single test file, e.g. pnpm test -- server/utils/vault-path.test.ts
pnpm exec eslint .   # lint (no dedicated `lint` script exists)
```

There is no dedicated `vitest.config.ts` — Vitest runs with defaults, no
Nuxt test environment wired in. Test files live next to the code they cover
(`server/utils/*.test.ts`), not in a separate `test/` tree, and only exist
under `server/utils/` today (`vault-path`, `password`, `indexer`, `trash`,
`templates`). Prefer this convention for new server-side unit tests.

Local dev without Docker needs `.env` with `NUXT_VAULT_PATH`/`NUXT_DATA_PATH`
pointed at local folders (copy `.env.example`).

## Architecture

**srcDir split**: Nuxt's `srcDir` is `app/` (client: pages, components,
composables, stores, editor helpers), separate from `server/` (Nitro:
routes, middleware, plugins, utils) at the project root. `shared/` holds
code imported by both sides (types, formatters, design tokens) — see the
style guide for the auto-import implications of this layout.

**Request flow for vault operations**: every `server/api/vault/*` route
takes a client-supplied relative path, resolves it through
`resolveVaultPath()` (`server/utils/vault-path.ts`) before any filesystem
access, and translates resolution failures to HTTP 400. This is the single
security choke point against path traversal — see decisions.md
("Path traversal defense is centralized") for what it does and doesn't
guard against.

**Auth**: two ordered Nitro middlewares (`server/middleware/1.setup-check.ts`,
`2.auth.ts`) gate everything — first-run redirects to `/setup` until an
admin exists, then `requireUserSession` protects `/api/vault/*`,
`/api/search`, `/api/settings/*`, `/api/templates/*`, `/api/trash/*`, and
`/api/admin/*`. Client-side, `app/middleware/auth.global.ts` mirrors this by
redirecting unauthenticated visits to `/login`.

**DB lifecycle**: `server/utils/db.ts` owns a single memoized
`initDb()`/`getDb()` pair — migrations in `server/database/migrations/*.sql`
run once at boot via `server/plugins/db.ts`, tracked with
`PRAGMA user_version`. Because Nitro doesn't guarantee plugin execution
order, `initDb()` memoizes the in-flight *promise*, not just the resolved
connection, so concurrent callers (e.g. `trash-cleanup.ts`'s own boot plugin)
never race a migration twice. `nitro.serverAssets` bundles the migrations
directory into `.output/`; it's read at runtime via `useStorage`.

**Rendering pipeline**: Markdown → HTML goes through a `unified` pipeline
(`server/utils/markdown/render.ts`): `remark-parse` → `remark-gfm` →
a custom `remark-wikilinks` plugin (resolves `[[wikilink]]` targets against
the vault tree, `resolve-wikilink-target.ts`) → `remark-rehype` →
`rehype-sanitize` → `rehype-stringify`. This is shared by the live-preview
render endpoint and note reading.

**Editor**: CodeMirror 6, one instance per open tab
(`app/components/NoteEditor.vue`, keyed by path so switching tabs remounts
rather than mutates state). Editor-specific behavior (slash commands,
wikilink autocomplete, live-preview decorations, smart list/quote
continuation) lives in `app/editor/*.ts` as CodeMirror extensions, not
inline in the component.

**State**: Pinia stores under `app/stores/` — `vaultTree` (file tree),
`tabs` (open tabs, dirty state, autosave conflict data), `preferences`
(user settings, synced with `server/api/settings/preferences.*`),
`sidebarPanel`/`mobileNav` (UI layout state). Autosave
(`app/composables/useAutosave.ts`) debounces writes and handles the
optimistic-concurrency 409 conflict returned by `PUT /api/vault/file` when
`lastKnownMtime` is stale.

**Trash & templates**: soft-delete moves files into a reserved vault
subfolder rather than unlinking (`server/utils/trash.ts`,
`server/utils/specialFolders.ts` defines the reserved paths); a boot plugin
(`server/plugins/trash-cleanup.ts`) purges entries past
`NUXT_TRASH_RETENTION_DAYS`. Templates (`server/utils/templates.ts`) are
also just vault-relative `.md` files under a reserved folder, listed/created
/deleted through `/api/templates/*` and instantiated via
`POST /api/vault/note-from-template`.

See `.claude/knowledge/web/synap-md/components.md` and `decisions.md` for
the full API surface, per-component notes, and the reasoning behind past
architectural decisions (env var prefixing, SSR fetch gotchas, FTS5 schema,
etc.) — check those before re-deriving something already documented there.

## Styling

Tailwind v4 only, enforced by `STYLEGUIDE.md`: no `<style>` blocks (not even
`scoped`), no inline `style=`, no arbitrary-value classes
(`bg-[#2a2a2a]`) outside `tailwind.config.ts`. Any new color/spacing/radius
value goes into `tailwind.config.ts` `theme.extend` first as a named token,
then gets consumed via the semantic class — never the reverse.
