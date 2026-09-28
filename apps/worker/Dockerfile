# Build from monorepo root: docker build -f apps/worker/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.4.4 prune @clear-money/worker --docker

FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY --from=prune /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @clear-money/domain build \
 && pnpm --filter @clear-money/db build \
 && pnpm --filter @clear-money/worker build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app /app

USER node
CMD ["node", "apps/worker/dist/index.js"]
