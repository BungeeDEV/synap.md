# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune synap-md --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
# Copy the content-addressable store populated by the installer stage so
# the builder's single pnpm install can reuse already-downloaded packages
# instead of fetching everything again.
COPY --from=installer /pnpm/store /pnpm/store
# Copy full source first so that pnpm's single install run below can
# properly hardlink the dependenciesMeta.injected packages (@synap/store,
# @synap/ui-vue) from their real source directories.  pnpm 10+ uses
# hardlinks from the CAS store for injected packages rather than copies,
# so the source must be present before install runs.
COPY --from=pruner /app/out/full/ .
# turbo prune --docker puts pnpm-lock.yaml only in out/json/, not out/full/.
# Copy it explicitly so pnpm can run --frozen-lockfile below.
COPY --from=pruner /app/out/json/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=synap-md...

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
RUN groupadd --system --gid 1001 nuxt && useradd --system --uid 1001 --gid nuxt nuxt
COPY --from=builder --chown=nuxt:nuxt /app/apps/web/.output ./.output
USER nuxt
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
