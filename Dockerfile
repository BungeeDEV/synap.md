# --- Build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# better-sqlite3 compiles a native addon during install
RUN apk add --no-cache python3 make g++

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --- Runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S synap && adduser -S synap -G synap

COPY --from=build /app/.output ./.output

USER synap

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
