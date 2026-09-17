FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
ENV CI=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm config set package-import-method copy

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/scraper/package.json ./apps/scraper/
COPY shared/database/package.json ./shared/database/
COPY shared/queue/package.json ./shared/queue/
COPY shared/shared-types/package.json ./shared/shared-types/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY shared/ ./shared/
COPY apps/scraper/ ./apps/scraper/

RUN pnpm --filter @oda/database run prisma:generate
RUN pnpm --filter @oda/scraper... build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @oda/scraper --prod deploy /app/deploy --legacy

FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app/apps/scraper

COPY --from=build /app/deploy ./
RUN ./node_modules/.bin/playwright install --with-deps chromium

CMD ["node", "dist/queue/dgp/dgpCli.js", "worker"]
