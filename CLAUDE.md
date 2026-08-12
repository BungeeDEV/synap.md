# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@.claude/styles/web/synap-md.md
@.claude/knowledge/web/synap-md/decisions.md
@.claude/knowledge/web/synap-md/components.md

## What this is

synap.md — a self-hosted, Obsidian-like Markdown notes app, plus a Tauri
desktop client that keeps a local copy of the vault and syncs it against
the server. For the server (`apps/web`), the vault (a directory of `.md`
files on disk) is the source of truth; SQLite (better-sqlite3) is only ever
a rebuildable search/index cache, never the data owner. Server deploys as a
single Docker container with a single `/data` volume (vault + SQLite), no
external services. `docs/sync-plan.md` is the shared design doc (German)
for the web↔desktop sync architecture — read it before touching sync-related
code in either app; it records architecture decisions as already-settled,
not open questions.

## Commands

```bash
pnpm dev             # start dev servers for every workspace app (turborepo)
pnpm build           # production build for all packages and apps
pnpm test            # vitest run workspace-wide
pnpm lint            # lint workspace-wide
pnpm --filter synap-md run dev       # dev server only for the Web App
pnpm --filter synap-desktop run dev  # Vite dev server only (frontend, no Tauri shell)
pnpm --filter synap-desktop run tauri:dev  # full desktop app with hot reload (Rust + WebView)
```

There is no dedicated `vitest.config.ts` — Vitest runs with defaults, no
Nuxt test environment wired in. Test files live next to the code they cover
(`apps/web/server/utils/*.test.ts`), not in a separate `test/` tree, and only exist
under `apps/web/server/utils/` today (`vault-path`, `password`, `indexer`, `trash`,
`templates`). Prefer this convention for new server-side unit tests.
`packages/*` have no real test suites (`"test": "echo No tests"`).

Local dev without Docker needs `.env` with `NUXT_VAULT_PATH`/`NUXT_DATA_PATH`
pointed at local folders (copy `.env.example`).

Package manager is pinned via `packageManager: pnpm@9.12.0` in the root
`package.json`. `pnpm-workspace.yaml` forces `vue>typescript` and
`pinia>typescript` to `7.0.2` across the whole workspace even though
`apps/web`/`apps/desktop` pin their own direct `typescript` devDependency to
different versions (`^5.7` / `~6.0.2`) — this exists to stop pnpm from
resolving that optional peer per-project and creating separate physical
vue/pinia instances (which broke Pinia's singleton `getActivePinia()` at
runtime). Don't "fix" this override without understanding why it's there —
see the comment in `pnpm-workspace.yaml`.

## Architecture

**Monorepo Workspace**: This is a Turborepo/pnpm workspace containing:
- `apps/web`: Nuxt 3 web application (synap.md)
- `apps/desktop`: Tauri 2 + Vite/Vue desktop application
- `packages/store`: Shared Pinia stores and API interfaces
- `packages/editor-core`: Shared Tiptap 3 extensions/logic (slash commands, wikilink autocomplete, upload placeholders, fuzzy search) — consumed by `packages/ui-vue`'s editor component, not directly by the apps
- `packages/ui-vue`: Shared Vue components
- `packages/design-tokens`: Shared CSS/Tailwind design tokens
- `packages/config-tailwind`: Shared Tailwind configs

**srcDir split (Web)**: Nuxt's `srcDir` is `apps/web/app/` (client: pages), separate from `apps/web/server/` (Nitro). Design tokens and components are sourced from `packages/`.

**Request flow for vault operations**: every `apps/web/server/api/vault/*` route
takes a client-supplied relative path, resolves it through
`resolveVaultPath()` (`apps/web/server/utils/vault-path.ts`) before any filesystem
access, and translates resolution failures to HTTP 400. This is the single
security choke point against path traversal — see decisions.md
("Path traversal defense is centralized") for what it does and doesn't
guard against.

**Auth**: two ordered Nitro middlewares (`apps/web/server/middleware/1.setup-check.ts`,
`2.auth.ts`) gate everything — first-run redirects to `/setup` until an
admin exists, then `requireUserSession` protects `/api/vault/*`,
`/api/search`, `/api/settings/*`, `/api/templates/*`, `/api/trash/*`, and
`/api/admin/*`. Client-side, `apps/web/app/middleware/auth.global.ts` mirrors this by
redirecting unauthenticated visits to `/login`.

**DB lifecycle**: `apps/web/server/utils/db.ts` owns a single memoized
`initDb()`/`getDb()` pair — migrations in `apps/web/server/database/migrations/*.sql`
run once at boot via `apps/web/server/plugins/db.ts`, tracked with
`PRAGMA user_version`. Because Nitro doesn't guarantee plugin execution
order, `initDb()` memoizes the in-flight *promise*, not just the resolved
connection, so concurrent callers (e.g. `trash-cleanup.ts`'s own boot plugin)
never race a migration twice. `nitro.serverAssets` bundles the migrations
directory into `.output/`; it's read at runtime via `useStorage`.

**Rendering pipeline**: Markdown → HTML goes through a `unified` pipeline
(`apps/web/server/utils/markdown/render.ts`): `remark-parse` → `remark-gfm` →
a custom `remark-wikilinks` plugin (resolves `[[wikilink]]` targets against
the vault tree, `resolve-wikilink-target.ts`) → `remark-rehype` →
`rehype-sanitize` → `rehype-stringify`. This is shared by the live-preview
render endpoint and note reading.

**Editor**: Tiptap 3, not CodeMirror — `apps/web/app/components/NoteEditor.vue`
is a thin wrapper (autosave wiring, attachment upload, conflict UI) around
`NoteEditor` from `@synap/ui-vue` (aliased `BaseNoteEditor`), keyed by path
so switching tabs remounts rather than mutates state. The actual editor —
extension list, slash commands, wikilink autocomplete/suggestion,
upload-placeholder handling — lives in `packages/editor-core` and is shared
byte-for-byte with `apps/desktop`; `packages/ui-vue`'s `NoteEditor.vue` owns
the Tiptap instance itself plus its menu subcomponents
(`EditorBubbleMenu`, `SlashCommandMenu`, `WikilinkSuggestionList`) and
exposes a narrow `replacePlaceholder(id, content)` method (via
`defineExpose`) so a parent can resolve an in-flight upload placeholder
without reaching into editor-core itself. This replaced an earlier
CodeMirror 6 + `apps/web/app/editor/*.ts` implementation — see decisions.md
("Editor rewrite: CodeMirror 6 → shared Tiptap 3 via editor-core/ui-vue")
before trusting any older entry that still describes CodeMirror.

**State**: Pinia stores under `apps/web/app/stores/` — `vaultTree` (file tree),
`tabs` (open tabs, dirty state, autosave conflict data), `preferences`
(user settings, synced with `apps/web/server/api/settings/preferences.*`),
`sidebarPanel`/`mobileNav` (UI layout state). Autosave
(`apps/web/app/composables/useAutosave.ts`) debounces writes and handles the
optimistic-concurrency 409 conflict returned by `PUT /api/vault/file` when
`lastKnownMtime` is stale.

**Trash & templates**: soft-delete moves files into a reserved vault
subfolder rather than unlinking (`apps/web/server/utils/trash.ts`,
`apps/web/server/utils/specialFolders.ts` defines the reserved paths); a boot plugin
(`apps/web/server/plugins/trash-cleanup.ts`) purges entries past
`NUXT_TRASH_RETENTION_DAYS`. Templates (`apps/web/server/utils/templates.ts`) are
also just vault-relative `.md` files under a reserved folder, listed/created
/deleted through `/api/templates/*` and instantiated via
`POST /api/vault/note-from-template`.

See `apps/web/.claude/knowledge/web/synap-md/components.md` and `decisions.md` for
the full API surface, per-component notes, and the reasoning behind past
architectural decisions (env var prefixing, SSR fetch gotchas, FTS5 schema,
etc.) — check those before re-deriving something already documented there.

**apps/desktop (Tauri 2 + Vue 3 + Rust)**: a native client that mirrors a
vault locally and syncs it against an `apps/web` server instance — not a
thin wrapper around the web app. Frontend (`apps/desktop/src/`) uses the
same shared `@synap/store`/`@synap/editor-core`/`@synap/ui-vue` packages as
the web app — including the exact same Tiptap-based `NoteEditor` component,
not a separate editor implementation. Backend is a single Rust crate (`apps/desktop/src-tauri/`, crate name `app`,
the sole member of the root `Cargo.toml` workspace) exposing Tauri commands
(`src/lib.rs`): `init_db`, `get_local_files`, `sync_now`,
`start_background_sync`, `push_file`, `pull_file`, `wipe_sync_db`. On
opening a vault it creates `<vault>/.synap/sync.db` (`rusqlite`, bundled
SQLite) tracking a per-file hash/status (`local`, `modified`, `Synced`,
`PendingUpload`, `deleted`); syncing diffs this against the server's
`/api/vault/manifest` and pushes/pulls through `/api/vault/sync/push` and
`/api/vault/sync/pull`. A `notify`-based filesystem watcher triggers a
re-sync on local changes; conflicts are last-write-wins with a conflict
copy (Dropbox-style), no CRDT. See `docs/sync-plan.md` for the full
rationale and `apps/desktop/README.md` for the frontend project layout.

## Styling

Both apps use Tailwind v4 only: no `<style>` blocks (not even `scoped`), no
inline `style=`, no arbitrary-value classes (`bg-[#2a2a2a]`) outside
`tailwind.config.ts`. Any new color/spacing/radius value goes into
`tailwind.config.ts` `theme.extend` first as a named token, then gets
consumed via the semantic class — never the reverse. This is written down
and enforced for `apps/web` in `apps/web/STYLEGUIDE.md`; `apps/desktop` has
no styleguide of its own but follows the same "Quiet Dark Editor" visual
language, ported 1:1 from the web app per
`apps/desktop/DESIGN-SYSTEM-EXPORT.md` — treat that file as the desktop
equivalent of the styleguide when touching its UI.
