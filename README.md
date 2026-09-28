# Clear Money

One ledger. Multiple spaces. Clear money.

Production-quality money tracking for Personal, Project, Family, and Company Spaces — Android, Apple, and browser — sharing one domain model for calculations and permissions.

## Stack

- `packages/domain` — money arithmetic, reports, goals, permissions, entitlements, notification planner
- `packages/db` — PostgreSQL + Drizzle
- `packages/i18n` — en / fr / ar message catalogs
- `packages/ui-tokens` — Clear Money CSS variables
- `apps/api` — Hono API + Better Auth
- `apps/worker` — OCR, AI reports, exports (pg-boss)
- `apps/web` — Next.js browser app
- `apps/mobile` — Expo Android / iOS

## Quick start

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter @clear-money/api dev
pnpm --filter @clear-money/web dev
pnpm --filter @clear-money/worker dev
pnpm --filter @clear-money/mobile start
```

Billing defaults to `BILLING_MODE=disabled` and `BETA_FREE_MODE=true` (no payment UI).

## Design

See [docs/DESIGN.md](docs/DESIGN.md). Acceptance matrix: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## Production plan (agents)

Agent-executable roadmap to production web + Play Closed Testing: [docs/PRODUCTION_PLAN.md](docs/PRODUCTION_PLAN.md). Work one phase at a time; mark tasks `[x]` when Done criteria pass.

## Tests

```bash
pnpm typecheck
pnpm test
```
