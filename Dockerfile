# --- Build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# better-sqlite3 compiles a native addon during install
RUN apk add --no-cache python3 make g++

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --- Runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# su-exec drops root privileges in entrypoint.sh after it fixes /data
# ownership - see entrypoint.sh for why the container can't just start as
# `synap` directly.
RUN apk add --no-cache su-exec && \
    addgroup -S synap && adduser -S synap -G synap

COPY --from=build /app/.output ./.output
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# No `USER synap` here - the container must start as root so entrypoint.sh
# can chown the mounted /data volume, then it drops to `synap` itself via
# su-exec before the app process (CMD below) runs.

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
