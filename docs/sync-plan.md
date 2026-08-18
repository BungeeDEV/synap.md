# synap – Sync Plan: Web App ↔ Tauri Desktop App

This file is the shared reference for two repos: the existing `synap.md` web app (Nuxt/Nitro) and a new Tauri desktop app (e.g., `synap-desktop`). Both repos will include this file (e.g., under `docs/sync-plan.md`) — it outlines the overall plan so that Claude has the same context when writing code in both repos, even when only the respective part is being implemented.

## Goal

A native Tauri 2 desktop app (Rust backend) that keeps the vault completely local, makes it fully editable offline, and syncs with the server in the background — ensuring the web vault (e.g., on mobile) and Tauri app (PC) always reflect the same state. Obsidian-like user experience as a model.

## Architectural Decisions (already made, do not re-discuss)

* **Sync Mechanism**: REST diff sync, hash/mtime-based. No Git, no built-in version history.
* **Conflict Strategy**: Last-Write-Wins + conflict copy for genuine simultaneous conflicts (like Dropbox), no CRDT/real-time merging.
* **Setup**: Single-user across multiple devices, no multi-user merging required.
* **Client Stack**: Tauri 2 + Rust, explicitly no Electron. Tooling/signing conventions can be adopted from the existing Tauri 2 project `nexo-suite`.
* **Existing Server Model remains untouched**: Vault = folder with real .md files on the server disk, SQLite is and remains only a rebuildable cache, never the data owner. `resolveVaultPath()` remains the sole security choke point for every file path — including for new sync endpoints, without exception.

## Phase Plan (order is binding, each phase only after confirmation)

| Phase | Content                                        | Repo                                       |
| ----- | ---------------------------------------------- | ------------------------------------------ |
| 0     | Validation/Proof of Concept (COMPLETED)        | Tauri (+ minimal server endpoints)         |
| 1     | Local Vault + full sync engine (COMPLETED)     | Tauri + Server                             |
| 2     | Editor reuse instead of text field (COMPLETED) | Tauri (+ web app for extraction if needed) |
| 3     | Native Polish (COMPLETED)                      | Tauri                                      |

Phase 0 has priority — the purpose is to prove that the chain fundamentally works before investing in the sync engine, secure auth storage, or the full editor.

---

## Part A — Responsibilities in the Web App Repo (synap.md)

### A1. Manifest Endpoint

`GET /api/vault/manifest` — returns a list of `{ path, hash, mtime, size }` per file for the entire vault (hash e.g., SHA-256 over the content). Check if the existing indexer (`server/utils/indexer.ts`) already includes these metadata; otherwise, consider a caching strategy for hashing (do not re-hash the entire vault on every request).

### A2. Batch Sync Endpoints

* `POST /api/vault/sync/pull` — takes a list of paths in, returns content + current hash/mtime per file out.
* `POST /api/vault/sync/push` — takes a list of `{ path, content, expectedMtime }` in, writes via the same path as the existing `PUT /api/vault/file` (including its 409 conflict detection), but batched; response per file: success or 409 with current server state.
* Every path in both endpoints must go through `resolveVaultPath()`.

### A3. Auth for Non-Browser Clients

Check if a token/API key mechanism already exists apart from the session cookie middleware (`requireUserSession`). If not: add a simple Personal Access Token mechanism (generatable in settings, display-only-once, optional expiration date) for the Tauri app.

---

## Part B — Responsibilities in the Tauri Repo (synap-desktop)

### B0. Phase 0 — Validation (COMPLETED)

* Set up Tauri 2 project (base structure/signing on `nexo-suite`)
* Minimal frontend: Server URL + token input (token only in plaintext state for now, will be replaced in Phase 3)
* Rust command against `GET /api/vault/manifest` (Part A1)
* Simple file list in the UI
* Click file → load content via `sync/pull`, display in a simple text field (no markdown rendering required)
* Edit + save via `sync/push`

**Definition of Done**: App connects, shows vault file list, can load/edit/save a file. No local vault, no offline mode, no diffing.

### B1. Phase 1 — Local Vault + Sync Engine (COMPLETED)

* Select/create local vault root (dialog on first launch)
* Local SQLite cache DB (`rusqlite`/`sqlx`): local hash/mtime per file AND last-successful-sync hash/mtime (for 3-way diff: local vs. last sync vs. server)
* File watcher (`notify` crate) for immediate local change detection
* HTTP client (`reqwest`) against Part A1/A2, auth via token from Phase 0
* Sync orchestration: full sync on startup, periodic background sync, immediate sync attempt on local change (debounced), offline queue for failed requests, automatic catch-up upon reconnection
* Conflict handling: only-local-changed → upload, only-remote-changed → download, both-changed → keep local version + server version as conflict copy (`Title (conflict from date).md`), visibly mark in the UI
* Deletions: first hash-compare against other new local files (move/rename detection) before propagating as a deletion to the server

**Definition of Done**: Two devices show the same vault state after a short time, even after offline changes. Genuine conflicts generate a conflict copy instead of data loss.

### B2. Phase 2 — Monorepo & Real Editor (COMPLETED)

* **Monorepo Infrastructure**: Successfully converted into a pnpm workspace + Turborepo.
* **Packages extracted**: The existing editor logic (now Tiptap instead of CodeMirror), UI components, and Pinia stores were extracted into `packages/editor-core`, `packages/ui-vue`, and `packages/store`.
* **Web App & Desktop App coupled**: Both consume the same shared packages.
* Sidebar/tree, tabs, and stores are built once in `packages/` and used by the apps via thin wiring.

### B3. Phase 3 — Native Polish (COMPLETED)

* Replace plaintext token from Phase 0 with secure storage (via `keyring`)
* System tray icon (sync even when window is minimized)
* Native drag & drop for .md import (Tauri drag-drop event redirected to the vault folder)
* Native OS notifications on sync conflicts (via `tauri-plugin-notification`)
* Optional autostart on login (via `tauri-plugin-autostart`)

---

## Cross-Cutting Requirements (apply to both repos)

* `resolveVaultPath()` for every file path, without exception, including in new batch/sync endpoints
* Reuse the existing write path and 409 conflict detection from `PUT /api/vault/file` instead of duplicating
* No Electron, no Node runtime in the Tauri client
* Rust code idiomatic, async where appropriate (Tauri 2 uses async commands natively)
* STYLEGUIDE.md (Tailwind v4 tokens, etc.) applies to all UI changes in the web app repo

## Open Items to be clarified by the respective status report

* Does token/API key auth already exist apart from session cookies?
* Does the indexer already track hash/mtime per file, or does it need to be newly calculated?
* How realistic is a true code extraction for Phase 2 (shared editor package) given the current srcDir structure (Nuxt `app/` vs. `server/`)?