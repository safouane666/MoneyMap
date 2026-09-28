# Build from monorepo root: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.4.4 prune @clear-money/api --docker

FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY --from=prune /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @clear-money/domain build \
 && pnpm --filter @clear-money/db build \
 && pnpm --filter @clear-money/api build

FROM base AS runner
ENV NODE_ENV=production
ENV API_PORT=3011
ENV PORT=3011
WORKDIR /app

# Full pruned workspace so `pnpm --filter @clear-money/db migrate|seed` works on the VPS.
COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 3011
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3011/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]
