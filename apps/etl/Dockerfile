FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
ENV CI=true
RUN pnpm config set package-import-method copy

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/etl/package.json ./apps/etl/
COPY shared/database/package.json ./shared/database/
COPY shared/queue/package.json ./shared/queue/
COPY shared/shared-types/package.json ./shared/shared-types/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY shared/ ./shared/
COPY apps/etl/ ./apps/etl/

RUN pnpm --filter @oda/database run prisma:generate
RUN pnpm --filter @oda/etl... build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @oda/etl --prod deploy /app/deploy --legacy

FROM node:22-alpine AS prod
ENV NODE_ENV=production
ENV SCRAPER_DATA_DIR=/data
WORKDIR /app

COPY --from=build /app/deploy ./
COPY --from=build /app/apps/etl/src/commom/qualis-capes-2017-2020.json ./dist/commom/

CMD ["node", "dist/queue/etlCli.js", "worker"]
