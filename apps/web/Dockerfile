# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
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
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# Re-run install so that `dependenciesMeta.injected` packages (@synap/store,
# @synap/ui-vue) are populated with their actual source files.  The installer
# stage runs `pnpm install` before source files exist (only out/json/ is
# available there), which leaves the injected node_modules copies empty.
RUN pnpm install --frozen-lockfile
RUN find /app -path "*/node_modules/pinia/dist/pinia.mjs" | sort
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
