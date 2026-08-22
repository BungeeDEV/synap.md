# Synap Desktop

Native Desktop-Client für **[synap.md](.)** — ein Markdown-Vault-Editor im Stil von Obsidian/Bear/iA Writer, gebaut mit **Tauri 2 + Vue 3**. Die App öffnet einen lokalen Ordner ("Vault") mit `.md`-Dateien, bietet einen Rich-Text/Markdown-Editor und synchronisiert den Vault bidirektional mit einem synap.md-Server.

## Features

- **Vault-Sidebar** mit Dateibaum, Ordner-Toggle und Sync-Status pro Datei
- **Markdown-Editor** (Tiptap) inkl. Task-Listen, Placeholder, Reader-Mode
- **Command Palette** für schnelle Datei-/Aktionssuche
- **Settings-Modal** für Editor (Schriftgröße, -familie, Zeilenhöhe) und Sync (Server-URL, Token, Auto-Sync)
- **Sync-Engine** (Rust/SQLite): Hash-basierter Abgleich lokaler Dateien mit dem Server, Push/Pull, Background-Sync-Loop, Dateisystem-Watcher für automatische Syncs bei lokalen Änderungen
- Dark-Editor-Design ("Quiet Dark Editor") — siehe [`DESIGN-SYSTEM-EXPORT.md`](./DESIGN-SYSTEM-EXPORT.md)

## Tech-Stack

| Bereich   | Technologie |
|-----------|-------------|
| Shell     | [Tauri 2](https://tauri.app) |
| Frontend  | Vue 3, TypeScript, Vite, Tailwind CSS v4 |
| Editor    | Tiptap (`@tiptap/vue-3`, `tiptap-markdown`) |
| Backend   | Rust — `rusqlite` (lokale Sync-DB), `reqwest` (HTTP), `notify` (Filesystem-Watcher) |
| Icons     | `@lucide/vue` |

## Voraussetzungen

- [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io)
- [Rust](https://www.rust-lang.org/tools/install) (stable) + Tauri-Systemabhängigkeiten für dein OS ([Tauri Prerequisites](https://tauri.app/start/prerequisites/))

## Entwicklung

```bash
pnpm install
pnpm dev              # nur Frontend (Vite Dev-Server, Port 5175)
pnpm tauri dev         # volle Desktop-App mit Hot-Reload
```

## Build

```bash
pnpm build             # tsc + Vite-Build
pnpm tauri build        # produktives Desktop-Binary/Installer
```

## Tests

Die Sync-Kernlogik im Rust-Backend (Pfad-Guard, Vault-Scan, Hashing, die
`sync_state`-Statusübergänge und die Push-Entscheidung) ist per `cargo test`
abgedeckt (`src-tauri/src/lib.rs`, `#[cfg(test)] mod tests`).

```bash
pnpm build                                              # einmal, erzeugt dist/
cargo test --manifest-path src-tauri/Cargo.toml
```

`pnpm build` muss vorher gelaufen sein: `generate_context!` bettet das
Frontend (`frontendDist: ../dist`) ein, sonst kompiliert das Crate nicht. In
CI läuft das als eigener `test-desktop`-Job.

## Projektstruktur

```
src/                  Vue-Frontend
  components/          VaultSidebar, EditorWorkspace, NoteEditor, CommandPalette, SettingsModal, FileTreeNode
  store.ts             Zentraler reaktiver App-State (Vault, Tabs, Sync, Settings)
src-tauri/            Rust-Backend
  src/lib.rs            Tauri-Commands: init_db, get_local_files, sync_now, start_background_sync, push_file, pull_file, wipe_sync_db
  tauri.conf.json       App-Konfiguration (Fenster, Bundle, Icons)
```

## Sync-Modell

Beim Öffnen eines Vaults wird unter `<vault>/.synap/sync.db` eine lokale SQLite-DB angelegt, die pro Datei Hash/Status (`local`, `modified`, `Synced`, `PendingUpload`, `deleted`) führt. Der Sync gleicht dies gegen das Manifest (`/api/vault/manifest`) des konfigurierten Servers ab und pusht/pullt geänderte Dateien (`/api/vault/sync/push`, `/api/vault/sync/pull`). Ein Filesystem-Watcher löst bei lokalen Änderungen automatisch einen erneuten Sync aus.
