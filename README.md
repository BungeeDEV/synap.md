# synap.md

Self-hosted, Obsidian-like notes app built on Nuxt 4. Markdown files on disk
(the "vault") are the source of truth; SQLite is only ever a search/index
cache, never the owner of your data.

## Stack

- Nuxt 4 / Vue 3 / TypeScript
- Nitro server routes as the backend (no separate backend service)
- better-sqlite3 for the index/cache database
- gray-matter for frontmatter parsing
- Tailwind 4 for styling

## Requirements

- Docker and Docker Compose (local self-hosting), **or**
- A [Dokploy](https://dokploy.com) instance (deploy straight from this repo)

## Local setup (Docker, recommended)

```bash
git clone <repo-url>
cd synap.md
cp .env.example .env
# edit .env: set NUXT_SESSION_PASSWORD to a random 32+ char secret
docker compose up -d
```

The app is then available at `http://localhost:3000` (or whatever `PORT`
you set in `.env`). All data (vault + SQLite index) lives in the `data`
Docker volume, mounted at `/data`. On first request you're redirected to
`/setup` automatically to create the admin account.

## Local development (without Docker)

```bash
pnpm install
cp .env.example .env   # adjust NUXT_VAULT_PATH/NUXT_DATA_PATH to local folders
pnpm dev
```

## Deploying with Dokploy

Dokploy builds this repo's `Dockerfile` directly via the `build:` context in
`docker-compose.yml` and redeploys automatically on every push - no separate
CI pipeline or container registry needed.

1. **Connect the repo** — in Dokploy, create a new Compose service and point
   it at this Git repository.
2. **Set the Compose path** — point it at `docker-compose.yml` in the repo
   root.
3. **Set environment variables** — in the service's Environment tab, add:
   | Variable | Example / notes |
   |---|---|
   | `NUXT_SESSION_PASSWORD` | **Must be a real secret**, 32+ chars. Generate one with `openssl rand -hex 32` |
   | `NUXT_VAULT_PATH` | `/data/vault` |
   | `NUXT_DATA_PATH` | `/data/app.db` |
   | `PORT` | `3000` |
   | `NUXT_TRASH_RETENTION_DAYS` | `30` |
   | `NUXT_MAX_ATTACHMENT_SIZE_MB` | `10` |

   These must be set explicitly in Dokploy's UI - `docker-compose.yml` only
   references them (`${VAR}`), it doesn't define their values, and unlike a
   `.env` file next to the compose file, Dokploy environment variables have
   to be entered there to reach the running container.
4. **Set the domain** — in the Domains tab, add your domain and let Dokploy
   handle TLS termination via its Traefik instance. Do not add a port
   mapping or Traefik labels yourself - the app only ever `expose`s its port
   internally (see `docker-compose.yml`), Dokploy's Traefik connects to it
   over the internal Docker network.
5. **Deploy.** On the very first request to your domain, synap.md
   automatically redirects to `/setup` so you can create the admin account -
   no manual init step required.

If "Isolated Deployments" is **not** enabled in your Dokploy project
settings, you'll additionally need to attach the service to the shared
`dokploy-network` - see the commented-out `networks:` block in
`docker-compose.yml`.

## Project layout

- `server/api/vault/` — Nitro API routes for vault file operations
- `server/utils/` — path resolving/sanitizing helpers, DB client
- `server/database/` — SQLite schema & migrations
- `app/` — Nuxt app (pages, components, composables)
