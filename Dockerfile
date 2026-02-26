FROM node:22-alpine AS base
RUN npm install -g pnpm

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/memory/package.json ./packages/memory/
COPY packages/trigger-engine/package.json ./packages/trigger-engine/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm -r build

# ── api ───────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS api
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /app .
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/server.js"]

# ── worker ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS worker
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /app .
WORKDIR /app/apps/api
ENV NODE_ENV=production
CMD ["node", "dist/worker.js"]