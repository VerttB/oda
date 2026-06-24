FROM node:20-alpine AS base
RUN npm i -g pnpm
FROM base AS build
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

COPY apps/api/package.json ./apps/api/
COPY shared/database/package.json ./shared/database/
COPY shared/cache/package.json ./shared/cache/
COPY shared/shared-types/package.json ./shared/shared-types/

RUN pnpm install --frozen-lockfile

COPY shared/ ./shared/
COPY apps/api/ ./apps/api/

RUN pnpm --filter @oda/database build
RUN pnpm --filter @oda/api build
RUN pnpm --filter @oda/api --prod deploy /app/deploy

FROM node:20-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/deploy ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
