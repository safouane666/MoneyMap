# Build from monorepo root: docker build -f apps/web/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.4.4 prune @clear-money/web --docker

FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY --from=prune /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
# Public URL baked at build time for any NEXT_PUBLIC_* usage (same-origin /cm-api by default).
ARG NEXT_PUBLIC_API_URL=/cm-api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @clear-money/domain build \
 && pnpm --filter @clear-money/web build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8259
ENV HOSTNAME=0.0.0.0
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 8259
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8259/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
