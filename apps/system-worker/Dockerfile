# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for workspace
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy package.json for system-worker and its workspace dependencies
COPY apps/system-worker/package.json ./apps/system-worker/
COPY shared/queue/package.json ./shared/queue/
COPY shared/database/package.json ./shared/database/
COPY shared/shared-types/package.json ./shared/shared-types/
COPY shared/cache/package.json ./shared/cache/

# Install dependencies (only for system-worker and deps)
RUN corepack enable pnpm && pnpm install --frozen-lockfile --filter @oda/system-worker...

# Copy source code for system-worker and its workspace dependencies
COPY apps/system-worker/src ./apps/system-worker/src
COPY apps/system-worker/tsconfig.json ./apps/system-worker/
COPY shared/queue/src ./shared/queue/src
COPY shared/queue/tsconfig.json ./shared/queue/
COPY shared/database/src ./shared/database/src
COPY shared/database/tsconfig.json ./shared/database/
COPY shared/shared-types/src ./shared/shared-types/src
COPY shared/shared-types/tsconfig.json ./shared/shared-types/
COPY shared/cache/src ./shared/cache/src
COPY shared/cache/tsconfig.json ./shared/cache/

# Copy prisma schema for database package
COPY shared/database/prisma ./shared/database/prisma

# Build shared packages first, then system-worker
RUN pnpm -F @oda/shared-types run build && \
    pnpm -F @oda/cache run build && \
    pnpm -F @oda/queue run build && \
    pnpm -F @oda/database run prisma:generate && \
    pnpm -F @oda/database run build && \
    pnpm -F @oda/system-worker run build

# Create production deployment
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @oda/system-worker --prod deploy /app/deploy --legacy

# Copy built dist files to deploy
RUN cp -r /app/apps/system-worker/dist /app/deploy/

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache bash postgresql-client

# Copy built files and dependencies from deploy
COPY --from=builder /app/deploy ./

# Use existing node user (uid/gid 1000)
USER node

# Default command - run worker
CMD ["node", "dist/queue/systemWorker.js"]