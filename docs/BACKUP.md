# Postgres backup & restore (Compose prod)

Run these from the repo root on the VPS (or any host running the prod Compose stack). Uses the `postgres` service from `docker-compose.yml` + `docker-compose.prod.yml`.

Compose shorthand used below:

```bash
export COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production"
```

Align `POSTGRES_USER` / DB name with `.env.production` `DATABASE_URL` (defaults: user `clearmoney`, db `clearmoney`).

## Dump (logical backup)

```bash
mkdir -p backups
$COMPOSE exec -T postgres pg_dump -U clearmoney -d clearmoney -Fc \
  > "backups/clearmoney-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Plain SQL alternative:

```bash
$COMPOSE exec -T postgres pg_dump -U clearmoney -d clearmoney \
  > "backups/clearmoney-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

Store dumps **off the VPS** (object storage, another machine). Do not commit dumps to git.

## Restore

Stop writers first (API/worker) so nothing races the restore:

```bash
$COMPOSE stop api worker web
```

Restore a custom-format dump (`-Fc`):

```bash
# Drop/recreate is destructive — confirm you have the right file.
$COMPOSE exec -T postgres dropdb -U clearmoney --if-exists clearmoney
$COMPOSE exec -T postgres createdb -U clearmoney clearmoney
cat backups/YOUR.dump | $COMPOSE exec -T postgres pg_restore -U clearmoney -d clearmoney --no-owner --role=clearmoney
```

Or plain SQL:

```bash
cat backups/YOUR.sql | $COMPOSE exec -T postgres psql -U clearmoney -d clearmoney
```

Then migrate (idempotent) and start again:

```bash
$COMPOSE run --rm api pnpm --filter @clear-money/db migrate
$COMPOSE start api worker web
```

## Migration discipline

1. **Always** run `pnpm --filter @clear-money/db migrate` (or the Compose `run --rm api … migrate` form in [DEPLOY_VPS.md](./DEPLOY_VPS.md)) after deploy **before** relying on new columns/tables.
2. Prefer forward-only migrations in `packages/db`; do not hand-edit production schema.
3. Take a dump **before** applying risky migrations on a live DB.
4. Seed (`pnpm --filter @clear-money/db seed`) is for demo/dev only — not part of production restore.

## Verify

```bash
$COMPOSE exec -T postgres psql -U clearmoney -d clearmoney -c '\dt'
curl -fsS http://localhost/health
```
