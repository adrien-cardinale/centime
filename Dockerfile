ARG BUN_IMAGE=oven/bun:1.3.6-slim

FROM ${BUN_IMAGE} AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/services/package.json packages/services/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --cwd apps/web build

FROM ${BUN_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/app/data/centime.db
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/services/package.json packages/services/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
RUN bun install --frozen-lockfile --production --filter '@centime/server'
COPY packages/core/src packages/core/src
COPY packages/db/src packages/db/src
COPY packages/services/src packages/services/src
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /app/data && chown bun:bun /app/data
USER bun
VOLUME /app/data
EXPOSE 3000
CMD ["bun", "apps/server/src/index.ts"]
