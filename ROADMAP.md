# Roadmap

Rough shape of what's planned. Nothing here has a committed date — see
[GitHub Issues](https://github.com/BungeeDEV/synap-monorepo/issues) for
what's actively being worked on, or to weigh in on an idea.

## Planned (in priority order)

1. **Version history** — per-note history, likely as its own reserved vault
   folder/snapshot mechanism (same pattern as `_trash`/`_archive`) rather
   than a full VCS. Currently there's explicitly none (see
   [`docs/sync-plan.md`](docs/sync-plan.md): "no built-in version history"
   was a deliberate Phase-1 decision, revisited here).
2. **Whiteboard support** — a canvas note type (drawings, arrows, sticky
   notes) alongside the Markdown editor, likely its own file format stored
   in the vault the same way notes are, not a separate backing store.
3. **Plugin system** — user-extensible slash commands/editor extensions.
   Needs a real security/sandboxing story before anything ships, since this
   is a self-hosted app that's often reachable from the internet.
4. **Multi-user / team vaulting / vault sharing** — the most invasive item
   on this list: it cuts against "self-hosted & single-user" as currently
   documented (see [Features](README.md#features) in the README) and
   [`docs/sync-plan.md`](docs/sync-plan.md)'s explicit single-user-across-devices
   decision. Needs its own design discussion before scoping, not just a
   checkbox here. Note that single-note public sharing (read-only link,
   optional password) already exists today — this item is about multiple
   real accounts collaborating on one private vault, which is a different
   problem.

## Under consideration

No priority order here, no commitment — just ideas that fit the project's
direction. Good candidates for an issue or discussion if one of these
appeals to you.

- **Wiki mode** — opt-in, read-only rendering of a folder or tag as a
  browsable public site. Builds on the single-note public sharing that
  already exists today, just scoped up to a whole folder/tag instead of
  one note at a time.
- **Graph view** — a visual map of the `[[wikilink]]` connections between
  notes. The editor already tracks wikilinks for autocomplete, so this is
  mostly a rendering/UI problem, not a new data layer.
- **Import from other tools** — bring in vaults from Obsidian, Logseq, or
  Notion exports. Lowers the switching cost for exactly the audience this
  app is positioned for.
- **Vault health checks** — surface broken wikilinks and orphaned notes,
  as a CLI command or an in-app panel.
- **Multi-vault support** — switch between multiple separate vaults (e.g.
  personal vs. work) instead of one vault per install.
- **Scheduled backups** — sync the vault to a second location (another
  server, S3-compatible bucket) on a configurable schedule.
- **Native Kanban support** — a simple Kanban board note type, alongside
  Markdown notes and the planned whiteboard type.
- **REST API + small CLI** — quick capture from the terminal
  (`synap new "..."`, piping stdin into a note), scripting against the
  vault.
- **Expanded template features** — dynamic template variables
  (`{{date}}`), cursor placement, and prompts on insert, building on the
  existing templates feature.
