# Deploy Clear Money on a VPS

Bring up the monorepo production stack: **Nginx → web + API**, plus **worker**, **Postgres**, and **MinIO**.

## Prerequisites

- Docker Engine + Compose v2.24+ (supports `ports: !reset` in the prod overlay)
- A clone of this repo on the server
- DNS A/AAAA records for your domain pointing at the VPS (required for real TLS)

## 1. Env file

```bash
cp .env.production.example .env.production
# Edit secrets: BETTER_AUTH_SECRET, DATABASE_URL password, MinIO keys, WEB_URL, BETTER_AUTH_URL
```

Set both public origins to the same HTTPS URL users will open (no `/cm-api` path):

```env
WEB_URL=https://your.domain.example
BETTER_AUTH_URL=https://your.domain.example
```

Internal URLs (defaults in Compose are fine):

```env
DATABASE_URL=postgresql://clearmoney:…@postgres:5432/clearmoney
S3_ENDPOINT=http://minio:9000
API_INTERNAL_URL=http://api:3011
```

Align `POSTGRES_*` in `docker-compose.yml` with the password in `DATABASE_URL` if you change it. Never commit `.env.production`.

For a **local HTTP smoke test** (no DNS):

```env
APP_ENV=production
WEB_URL=http://localhost
BETTER_AUTH_URL=http://localhost
BETTER_AUTH_SECRET=local-smoke-secret-at-least-32-chars!!
DATABASE_URL=postgresql://clearmoney:clearmoney@postgres:5432/clearmoney
```

## 2. Start the stack

### A) Dedicated VPS (MoneyMap owns :80/:443)

From the repo root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Only **Nginx** publishes host ports **80** and **443**. Postgres/MinIO stay on the Docker network (the prod overlay clears their host port maps). Day-to-day local DB/MinIO via `docker-compose.yml` alone is unchanged.

### B) Shared host with an existing edge nginx (e.g. Nexus)

If another stack already binds **80/443**, use the VPS overlay (no MoneyMap edge nginx) and route the subdomain through the existing proxy:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml \
  --env-file .env.production up -d --build
```

- Attach `moneymap-api` / `moneymap-web` to the edge Docker network.
- Use nginx snippets in `deploy/nginx/moneymap.phronexus-ai.com*.conf` (HTTP bootstrap, then TLS).
- Set `DATABASE_URL` host to **`moneymap-postgres`** (not `postgres`) so it does not collide with another DB on the shared network.

## 3. Migrate (and optional seed)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production \
  run --rm api pnpm --filter @clear-money/db migrate

# Optional demo data (dev/demo only — not required for production)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production \
  run --rm api pnpm --filter @clear-money/db seed
```

## 4. Smoke checks

```bash
curl -fsS http://localhost/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost/
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost/privacy
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost/terms
```

Path conventions (matches `apps/api` + web `/cm-api` proxy):

| Public URL | Upstream |
| --- | --- |
| `/` | `web:8259` |
| `/cm-api/auth/*` | `api:3011/cm-api/auth/*` (path kept) |
| `/cm-api/*` (non-auth) | `api:3011/*` (`/cm-api` stripped) |
| `/health` | `api:3011/health` |

## 5. TLS

HTTP-only is enough for a local Compose smoke test. On a real VPS:

**Option A — Certbot (recommended)**  
Install certbot, obtain certs for your domain, then either:

- Mount Let’s Encrypt files into `deploy/certs/` as `fullchain.pem` + `privkey.pem`, or  
- Point Nginx `ssl_certificate*` at `/etc/letsencrypt/live/<domain>/…` via an extra volume.

Copy `deploy/nginx/conf.d/ssl.conf.example` → `deploy/nginx/conf.d/ssl.conf`, set `server_name`, uncomment the HTTPS server (and optional HTTP→HTTPS redirect), reload Nginx:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload
```

**Option B — Mount existing certs**  
Place `fullchain.pem` and `privkey.pem` in `deploy/certs/` (gitignored contents; directory is mounted read-only).

After HTTPS works, set `WEB_URL` / `BETTER_AUTH_URL` to `https://…` and recreate API/web so trusted origins and cookies match.

## 6. Useful commands

```bash
# Logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production logs -f api web worker nginx

# Stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production down
```

## Notes

- The **worker** service is part of `docker-compose.prod.yml` (same stack as api/web). Locally you can also run it with `pnpm --filter @clear-money/worker start` (or `dev`). Job status is available via `GET /jobs/:id`; the web app uses client-side CSV export and does not poll jobs.
- **Backups:** see [BACKUP.md](./BACKUP.md) for Postgres dump/restore on this Compose stack.
- Mobile release builds (Phase 6) should use `https://your.domain.example/cm-api` as the API base — never localhost.
- `BETA_FREE_MODE=true` keeps billing in free/beta mode until Stripe live is intentional.
- Privacy/terms routes are hosted at `/privacy` and `/terms`; replace placeholder copy with legal text before store listing.
- Optional crash reporting: set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (web) and `EXPO_PUBLIC_SENTRY_DSN` (mobile), then install the Sentry SDK — stubs no-op when unset (see Phase 7 / P7.1).

## Google OAuth (optional)

1. Create an OAuth client in Google Cloud Console (Web application).
2. Authorized JavaScript origins: `https://your.domain.example` (and `http://localhost:8259` for local).
3. Authorized redirect URIs (Better Auth callback):
   - `https://your.domain.example/cm-api/auth/callback/google`
   - `http://localhost:8259/cm-api/auth/callback/google` (local)
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.production`. If unset, the Google button is hidden (`GET /public/auth-config`).
5. After Google sign-in, the web ledger applies setup locale/currency via `/me/setup-complete` (same prefs as email sign-up).
