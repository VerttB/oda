FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
ENV CI=true

RUN pnpm config set package-import-method copy

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

COPY apps/api/package.json ./apps/api/
COPY shared/database/package.json ./shared/database/
COPY shared/cache/package.json ./shared/cache/
COPY shared/shared-types/package.json ./shared/shared-types/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY shared/ ./shared/
COPY apps/api/ ./apps/api/

RUN pnpm --filter @oda/database run prisma:generate
RUN pnpm --filter @oda/api... build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @oda/api --prod deploy /app/deploy --legacy

FROM node:22-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/deploy ./
RUN mkdir -p /app/static

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
