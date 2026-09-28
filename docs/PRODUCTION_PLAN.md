# Clear Money — Production Execution Plan

Agent-ready plan to take Clear Money from demo prototype to the **final monorepo + VPS + mobile** ship shape. Work **one phase at a time**. Do not start a later phase until the current phase’s Done criteria pass.

## Final objective (north star)

One monorepo that contains everything needed to run and ship:

| Piece | Lives in monorepo | Runs / ships as |
| --- | --- | --- |
| API (+ worker) | `apps/api`, `apps/worker` | Docker services on the VPS |
| Postgres + object storage | `docker-compose` (prod overlay) | Docker on the VPS |
| Nginx (TLS reverse proxy) | `deploy/nginx/` (to add) | Front door on the VPS (`https://…` → web + `/cm-api` → API) |
| Browser frontend | `apps/web` | Docker/Next on the VPS behind Nginx |
| Android app | `apps/mobile` | **APK** (and later AAB) built with EAS, `EXPO_PUBLIC_API_URL` → production HTTPS API |
| iOS app | `apps/mobile` | **IPA / simulator / TestFlight build** with the **same** production API URL |

```
Internet → Nginx (443)
            ├─ /           → web (Next)
            └─ /cm-api/*   → api (Hono)
                              ├─ Postgres
                              ├─ Worker
                              └─ MinIO/S3
Mobile APK / iOS build ──HTTPS──→ same API origin (or same host /cm-api)
```

**Not in the repo today:** production Compose stack for api/web/worker/nginx (only local Postgres+MinIO), no Nginx configs, no EAS profiles, mobile still points at localhost and fakes auth.

## How agents must work

1. Read this file and `docs/ACCEPTANCE.md` / `docs/DESIGN.md` before coding.
2. Prefer small, focused changes. Match existing patterns in the monorepo.
3. Never commit `.env`, secrets, API keys, or OAuth client secrets.
4. After each task: run the listed verification commands; update the task checkbox to `[x]` in this file in the same PR/commit when possible.
5. If blocked (missing credentials, product decision), stop and document the blocker under **Open blockers** at the bottom — do not invent credentials or skip security.
6. Keep the product light and simple: no new features outside this plan unless required for a listed Done criterion.

## Current baseline (as of 2026-09-28)

| Surface | Maturity |
| --- | --- |
| Domain / DB / API / Worker | Substantial; some stubs and weak validation |
| Web (`apps/web`) | Demo-capable after fresh sign-up; gaps in settings privacy, seed login, some UI stubs |
| Mobile (`apps/mobile`) | Expo Go prototype; fake auth; no EAS / APK / iOS pipeline |
| VPS stack | Local compose = Postgres + MinIO only; **no Nginx**, api/web not containerized for VPS |

Known open demo gaps (fix early if touching those areas):

- Seed creates `demo@clearmoney.app` users **without** Better Auth `account` password rows (`packages/db/src/seed.ts`).
- Settings “Export my data” and “Confirm delete” are not wired (`apps/web/src/app/app/settings/page.tsx`).
- Mobile sign-in ignores credentials (`apps/mobile/app/auth/sign-in.tsx`).

---

## Phase 0 — Repo hygiene and agent guardrails

**Goal:** Safe defaults so agents cannot ship secrets or break the money model.

### Tasks

- [x] **P0.1** Ensure `.gitignore` excludes `.env*`, `.lan-logs`, `tmp*`, build outputs.
- [ ] **P0.2** Align `.env.example` with real required vars (no secrets). Document `BETTER_AUTH_URL` as the **web origin** (cookie host), not the API port, when using `/cm-api` proxy.
- [ ] **P0.3** Add/confirm root scripts: `typecheck`, `test`, `db:migrate`, `db:seed`.
- [ ] **P0.4** Remove or gate non-production shortcuts when `APP_ENV=production` (e.g. `x-user-id` impersonation in `apps/api/src/app.ts`).

### Done when

- `pnpm typecheck` and `pnpm test` run clean on a fresh clone with Docker Postgres.
- No secrets in tracked files (`rg` for `sk_live|GOCSPX|nxs_live|password=` in tracked sources should be empty of real secrets).

### Verify

```bash
pnpm typecheck
pnpm test
```

---

## Phase 1 — Auth & identity (web + API)

**Goal:** Sign-up, sign-in, session cookies, and demo seed login work reliably.

### Tasks

- [ ] **P1.1** Seed Better Auth credential rows for demo users (hashed passwords) in `packages/db/src/seed.ts`; document password in README (dev only).
- [ ] **P1.2** Confirm Better Auth `baseURL` / `basePath` / web `/cm-api` proxy stay aligned (`apps/api/src/auth.ts`, `apps/web/src/app/cm-api/[...path]/route.ts`).
- [ ] **P1.3** Production cookie posture: `useSecureCookies: true` when HTTPS; trusted origins from env only.
- [ ] **P1.4** Wire Settings → Export (`GET /account/export`) and Delete (`POST /account/delete`) in `apps/web/src/app/app/settings/page.tsx`.
- [ ] **P1.5** Google OAuth: document redirect URIs; fail gracefully if unset; complete setup prefs after social sign-in (parity with email `setup-complete`).
- [ ] **P1.6** Replace hardcoded LAN URLs in i18n `auth.serverUnreachable` with generic copy or `WEB_URL`-derived messaging.

### Done when

- Email sign-up → Home with Personal space.
- Seeded `demo@…` signs in with documented password and sees seeded spaces.
- Export downloads data; delete removes session and anonymizes per API contract.
- No auth 404s through `/cm-api/auth/*`.

### Verify

```bash
pnpm --filter @clear-money/api test
pnpm --filter @clear-money/web test
# Manual: sign-in, export, delete on local stack
```

---

## Phase 2 — Core money loop correctness (web + API)

**Goal:** Add / undo / totals / reports are trustworthy and fail visibly.

### Tasks

- [ ] **P2.1** Validate transaction create: `amountMinor > 0`, allowed `type`, currency matches space (or explicit FX policy).
- [ ] **P2.2** Scope mutations by `spaceId` (PATCH/DELETE/confirm must assert txn belongs to space).
- [ ] **P2.3** Surface API errors on add/undo (stop swallowing `.catch(() => undefined)` in `apps/web/src/lib/ledger.tsx`).
- [ ] **P2.4** Decide transfer product: either implement transfer UI + API pair rules, or remove transfer from seed/UI copy until ready.
- [ ] **P2.5** Reports: use API `/spaces/:id/reports` or keep client totals but add parity test against domain fixtures.
- [ ] **P2.6** Fix Reports → Time tab (chart or remove tab until real).
- [ ] **P2.7** Settings currency must update user profile / active display path consistently (not only `cm.setup.session`).

### Done when

- New expense appears on Home and Activity; undo removes it from totals; refresh keeps consistency.
- Failed network save shows an error; optimistic UI rolls back or retries clearly.
- Playwright (or documented manual) covers add + undo.

### Verify

```bash
pnpm --filter @clear-money/domain test
pnpm --filter @clear-money/web e2e
```

---

## Phase 3 — Spaces, roles, invites

**Goal:** Multi-space demo and permissions are real, not decorative.

### Tasks

- [ ] **P3.1** Invite email optional; copy-link accept flow stable; public invite GET does not over-expose PII.
- [ ] **P3.2** Role change UI for admins/owners (API already has PATCH role — add allowlist validation).
- [ ] **P3.3** Viewer cannot see create controls (PermissionGate); Child cannot see others’ entries (`filterVisibleEntries`).
- [ ] **P3.4** Space create validates `type` ∈ personal|project|family|company.

### Done when

- Accept matrix rows P1–P3 in `docs/ACCEPTANCE.md` pass automated or checklisted.

### Verify

```bash
pnpm --filter @clear-money/api test
# Manual: invite accept + viewer/child checks
```

---

## Phase 4 — Goals, exports, worker

**Goal:** Background jobs either work or are hidden.

### Tasks

- [ ] **P4.1** CSV export: fix API header/body mismatch if API path is used; keep client CSV only if intentional.
- [ ] **P4.2** PDF/XLSX: produce real files in object storage **or** hide async export UI until ready.
- [ ] **P4.3** Worker runs under process manager; job status queued → running → succeeded/failed visible if UI uses jobs.
- [ ] **P4.4** Goals: contributions path or clear UX that `savedMinor` is manual only.
- [ ] **P4.5** OCR / voice / AI monthly: without keys, UI must degrade (manual entry works); never block core ledger.

### Done when

- Killing the worker does not break add/list/CSV.
- With worker + storage configured, one export job completes end-to-end **or** export UI only offers working CSV.

### Verify

```bash
pnpm --filter @clear-money/worker test
```

---

## Phase 5 — VPS stack in the monorepo (Compose + Nginx)

**Goal:** The monorepo ships a VPS-ready stack: API, worker, web, Postgres, storage, and Nginx with TLS. Browser users hit the same host the mobile apps will use.

### Tasks

- [ ] **P5.1** Add production Dockerfiles for `apps/api`, `apps/web`, `apps/worker` (multi-stage, non-root where practical).
- [ ] **P5.2** Extend Compose: `docker-compose.yml` (or `docker-compose.prod.yml`) with `api`, `web`, `worker`, `postgres`, `minio` (or S3), and `nginx` — not only local DB/MinIO.
- [ ] **P5.3** Add `deploy/nginx/` config: TLS termination; `/` → web; `/cm-api/` → api; WebSocket/SSE if needed; sensible upload size for receipts later.
- [ ] **P5.4** Document VPS bring-up in `docs/DEPLOY_VPS.md` (clone, env file on server, `docker compose up`, migrate, seed optional).
- [ ] **P5.5** Env contract: `WEB_URL` / `BETTER_AUTH_URL` = public `https://domain`; API internal URL for web container; secrets only on the VPS (never in git).
- [ ] **P5.6** TLS everywhere; `APP_ENV=production`; strong `BETTER_AUTH_SECRET`; secure cookies on; CORS / trustedOrigins = production origin (+ mobile scheme if required).
- [ ] **P5.7** Rate limits, health checks (`/health`), basic logging.
- [ ] **P5.8** Host `/privacy` and `/terms` on the web app (stores + finance).
- [ ] **P5.9** Billing: keep `BETA_FREE_MODE` for beta **or** complete Stripe live checklist — do not half-enable checkout.

### Done when

- On a VPS (or equivalent), `docker compose` brings up Nginx + web + api + worker + db; HTTPS works.
- Browser: sign up → add expense → sign out → sign in on the public URL.
- Mobile can use the **same** public API base URL (Phase 6).
- Privacy/terms load without auth.

### Verify

```bash
# On VPS or local prod-compose profile:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
curl -fsS https://$DOMAIN/health   # or via nginx path if health is only on api
curl -fsS -o /dev/null -w "%{http_code}\n" https://$DOMAIN/
```

---

## Phase 6 — Mobile builds pointing at the VPS (Android APK + iOS)

**Goal:** Real mobile apps (not Expo Go): auth → personal space → add → list → sync against the **production HTTPS API** from Phase 5. Ship an **Android APK** and an **iOS build** configured with that server URL. Store listing (Play/App Store) can follow; binary + server wiring is the MVP.

### Tasks

- [ ] **P6.1** Wire email sign-in/up to API with session in `expo-secure-store` (stop fake `router.replace` on auth screens).
- [ ] **P6.2** Release builds set `EXPO_PUBLIC_API_URL` (or EAS env) to `https://<domain>/cm-api` or the public API origin — **never** `localhost` / LAN IPs in release profiles.
- [ ] **P6.3** Fix sync path to `POST /spaces/:spaceId/transactions` with idempotency; share one store between Add and Activity.
- [ ] **P6.4** Home totals from persisted/synced transactions.
- [ ] **P6.5** Offline queue: enqueue when offline; `reconcile` on reconnect without duplicates (use existing `src/offline` tests as contract).
- [ ] **P6.6** Replace placeholder icons/splash with real assets (512+).
- [ ] **P6.7** Add `eas.json` with profiles:
  - `preview` / `apk` → Android **APK** for sideload / internal testers
  - `production` → Android **AAB** (when Play upload is needed)
  - `ios` → iOS build (simulator and/or device / TestFlight)
- [ ] **P6.8** Produce Android APK via EAS (or local) and install on a physical device; confirm it talks to the VPS API.
- [ ] **P6.9** Produce iOS build via EAS; run on simulator or TestFlight device against the same API URL. (Apple Developer account required for device/TestFlight.)
- [ ] **P6.10** Document install + API URL in `apps/mobile/README.md` (how to rebuild when domain changes).
- [ ] **P6.11** Remove README claims for camera/biometrics until implemented; trim unused permissions.
- [ ] **P6.12** v1 monetization: **free only** on mobile (no Stripe IAP evasion). Play/App Store Billing only in Phase 8 if needed.

### Done when

- Android APK installed on a phone: sign in → add expense → see it after kill/relaunch → offline then reconnect without duplicate — all against the VPS.
- iOS build does the same against the same API URL (simulator acceptable if device certs are blocked; device/TestFlight preferred).
- No release binary embeds `localhost` or Tailscale demo hosts.

### Verify

```bash
pnpm --filter @clear-money/mobile test
pnpm --filter @clear-money/mobile typecheck
# EAS examples:
# eas build --platform android --profile apk
# eas build --platform ios --profile ios
```

---

## Phase 7 — Hardening & observability

**Goal:** Production weaknesses closed on the VPS + clients.

### Tasks

- [ ] **P7.1** Crash reporting (Sentry or equivalent) on web + mobile.
- [ ] **P7.2** Structured API error codes; no raw provider strings in user-facing UI.
- [ ] **P7.3** Backup/restore runbook for Postgres on the VPS; migration discipline.
- [ ] **P7.4** Security pass: webhook signature verification if Stripe live; invite PII; disable stub billing webhook in production; Nginx hardening (headers, rate limit at edge optional).
- [ ] **P7.5** Update `docs/ACCEPTANCE.md` so claimed test paths exist; add missing API integration tests under `apps/api/src/__tests__` or stop claiming them.

### Done when

- One forced crash appears in the error tracker.
- Production config checklist in `docs/ACCEPTANCE.md` is fully checked.

---

## Phase 8 — Optional later (stores & parity)

Do **not** start these until Phases 0–7 Done criteria pass unless product prioritizes them:

- Google Play Console listing + AAB Closed/Open testing (APK already exists from Phase 6).
- Apple App Store / TestFlight public distribution (beyond internal build).
- Full mobile parity: goals, AI chat, OCR, invites, spaces management, reports charts.
- Google Play Billing / App Store IAP for Plus.
- Transfer dual-entry, scheduled expenses, approvals.
- Advanced AI features requiring always-on worker + keys.

---

## Suggested agent assignment order

| Agent wave | Phases | Parallelism |
| --- | --- | --- |
| Wave A | Phase 0 → 1 → 2 | Sequential (auth before money loop) |
| Wave B | Phase 3 + 4 | Parallel after Phase 2 |
| Wave C | Phase 5 (Compose + Nginx + VPS) | Needs domain/DNS/secrets from human |
| Wave D | Phase 6 (APK + iOS → same API) | After Phase 5 public HTTPS URL exists |
| Wave E | Phase 7 | After first VPS deploy |

Human-required inputs (agents must not invent):

- VPS + domain + DNS pointing at the server
- TLS (Let’s Encrypt or provided certs)
- EAS / Expo account
- Apple Developer account (for device/TestFlight iOS)
- Google Play account (only when uploading AAB — Phase 8)
- Privacy policy legal text (or approved draft)
- Stripe live keys (only if enabling paid)
- Google OAuth production client IDs
- AI provider key (optional; app must work without it)

---

## Open blockers

| ID | Blocker | Owner |
| --- | --- | --- |
| B1 | VPS + domain not chosen | Human |
| B2 | EAS account; Apple Developer (for iOS device builds) | Human |
| B3 | Privacy/terms legal copy | Human |
| B4 | Whether v1 mobile is free-only | Human (recommend: yes) |
| B5 | Play Console (only if publishing AAB beyond sideload APK) | Human |

---

## Definition of “production ready”

Ship is allowed when:

1. Phases **0–5** Done criteria are met — monorepo VPS stack (Compose + Nginx + API + web + worker) on HTTPS.
2. Phase **6** Done criteria are met — **Android APK** and **iOS build** both point at that server and complete the money loop.
3. Phase **7** P7.4–P7.5 complete (security + acceptance honesty).
4. Core ledger works with AI/OCR/billing **off**.
5. No tracked secrets; `APP_ENV=production` uses secure cookies and no impersonation header.
6. Store listing (Play/App Store) is **optional** and tracked in Phase 8 — not required for “server + APK/iOS pointing at server.”
