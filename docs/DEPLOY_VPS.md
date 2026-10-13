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
- Use nginx snippets in `deploy/nginx/penny.phronexus-ai.com*.conf` (HTTP bootstrap, then TLS). Keep `moneymap.phronexus-ai.com*.conf` as redirects to the new host.
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

## Domain rename (moneymap → penny)

Not a rewrite of the stack — same containers, new public hostname.

1. **DNS** — add `A` (and optional `AAAA`) for `penny.phronexus-ai.com` → VPS IP (same as moneymap). Wait for propagation.
2. **TLS** — issue a cert for the new host (certbot / your usual flow), then install `deploy/nginx/penny.phronexus-ai.com.conf` into nexus-nginx and reload.
3. **Env** — on the VPS set `WEB_URL` and `BETTER_AUTH_URL` to `https://penny.phronexus-ai.com`, then recreate `api` + `web` (no DB reset).
4. **Google OAuth** — add the new origin + `https://penny.phronexus-ai.com/cm-api/auth/callback/google` in Google Cloud Console (keep the old ones until redirects settle).
5. **Legacy** — keep `moneymap.phronexus-ai.com` nginx as a 301 to `penny.phronexus-ai.com` so old links and APKs still land somewhere useful.
6. **Mobile** — rebuild EAS with `eas.json` pointing at `https://penny.phronexus-ai.com` (already set in repo).

## Google OAuth (Penny — replace Peerbet / shared clients)

User data lives in **Postgres** (`user`, `account`, spaces, transactions). Swapping the Google Cloud OAuth app does **not** wipe the DB.

### Why existing users stay linked

Better Auth stores Google’s stable user id (`sub`) in `account.account_id` with `provider_id = 'google'`. That `sub` is the same for a Google account across OAuth **client IDs**, so after you put a new Penny client on the VPS, the same people sign in to the **same** `user` rows (ledgers intact). Email/password users are unchanged.

### Do / don’t

| Do | Don’t |
| --- | --- |
| Create a dedicated GCP project / OAuth client branded **Penny** | Reset Postgres or recreate volumes |
| Only replace `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.production` | Change `BETTER_AUTH_SECRET` unless you accept logging everyone out |
| Keep `WEB_URL` / `BETTER_AUTH_URL` aligned with the live HTTPS host | Run `seed` against production |
| Recreate **api** (and web) after env change | Delete rows in `user` / `account` |

### Create the Penny OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) → new project **Penny** (or rename consent screen away from Peerbet).
2. APIs & Services → **OAuth consent screen**: app name **Penny**, support email `pennyaitracker@gmail.com`.
3. **Credentials** → Create OAuth client ID → type **Web application**.
4. Authorized JavaScript origins:
   - `https://penny.phronexus-ai.com`
   - `https://moneymap.phronexus-ai.com` (optional during redirect period)
   - `http://localhost:8259` (local)
5. Authorized redirect URIs:
   - `https://penny.phronexus-ai.com/cm-api/auth/callback/google`
   - `https://moneymap.phronexus-ai.com/cm-api/auth/callback/google` (optional during cutover)
   - `http://localhost:8259/cm-api/auth/callback/google`
6. Put the new id/secret in VPS `.env.production` only (never commit). Then:

```bash
cd ~/Documents/moneyMap-workspace/MoneyMap
# edit .env.production GOOGLE_* then:
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml \
  --env-file .env.production up -d --force-recreate api web
# Do NOT docker compose down -v / do NOT wipe postgres
```

7. Smoke: open sign-in → Google → confirm you land on the same spaces/transactions as before.
8. If unset, the Google button stays hidden (`GET /public/auth-config`).
