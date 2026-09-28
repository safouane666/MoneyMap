# Clear Money — Production Execution Plan

Agent-ready plan to take Clear Money from demo prototype to production (web + Android Play Closed Testing). Work **one phase at a time**. Do not start a later phase until the current phase’s Done criteria pass.

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
| Mobile (`apps/mobile`) | Expo Go prototype; fake auth; no EAS/Play pipeline |
| Hosting | Local / LAN / Tailscale only — not production HTTPS |

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

## Phase 5 — Production web hosting

**Goal:** Public HTTPS web app + API suitable for real users (and mobile later).

### Tasks

- [ ] **P5.1** Deploy Postgres, API, web, worker, object storage with secrets from a vault (not `.env` in git).
- [ ] **P5.2** TLS everywhere; `APP_ENV=production`; strong `BETTER_AUTH_SECRET`; secure cookies on.
- [ ] **P5.3** CORS / trustedOrigins = production web origin only (+ intentional extras).
- [ ] **P5.4** Rate limits confirmed on auth, invites, AI, OCR, export.
- [ ] **P5.5** Health checks, basic logging, uptime alert.
- [ ] **P5.6** Host `/privacy` and `/terms` pages (required for stores and finance apps).
- [ ] **P5.7** Billing: keep `BETA_FREE_MODE` for beta **or** complete Stripe live checklist in `docs/ACCEPTANCE.md` — do not half-enable checkout.

### Done when

- Fresh device can open production URL, sign up, add expense, sign out, sign in.
- Privacy/terms URLs load without auth.

### Verify

- Manual production smoke checklist (document results in PR).

---

## Phase 6 — Mobile MVP (Play Closed Testing)

**Goal:** Real Android app: auth → space → add → list → sync. Not full web parity.

### Tasks

- [ ] **P6.1** Wire email sign-in/up to API with session in `expo-secure-store` (stop fake `router.replace` on auth screens).
- [ ] **P6.2** Set `EXPO_PUBLIC_API_URL` to production HTTPS API (never ship `localhost` defaults in release builds).
- [ ] **P6.3** Fix sync path to `POST /spaces/:spaceId/transactions` with idempotency; share one store between Add and Activity.
- [ ] **P6.4** Home totals from persisted/synced transactions.
- [ ] **P6.5** Offline queue: enqueue when offline; `reconcile` on reconnect without duplicates (use existing `src/offline` tests as contract).
- [ ] **P6.6** Replace placeholder icons/splash with store-grade assets (512+).
- [ ] **P6.7** Add `eas.json`, real EAS projectId, Android package `app.clearmoney.mobile`, `versionCode` strategy.
- [ ] **P6.8** Build AAB via EAS; upload to Play Closed Testing.
- [ ] **P6.9** Play Console: Data safety, content rating, privacy policy URL, screenshots, short/full description.
- [ ] **P6.10** Remove README claims for camera/biometrics until implemented; trim unused permissions.
- [ ] **P6.11** v1 monetization: **free only** on Android (no Stripe IAP evasion). Play Billing only in a later phase if needed.

### Done when

- Closed testers install AAB, sign in against production API, add an expense, see it after kill/relaunch, and after airplane-mode → reconnect without duplicate.
- Play listing has privacy policy URL and Data safety filled.

### Verify

```bash
pnpm --filter @clear-money/mobile test
pnpm --filter @clear-money/mobile typecheck
# EAS: eas build --platform android --profile preview|production
```

---

## Phase 7 — Hardening & observability

**Goal:** Production weaknesses closed.

### Tasks

- [ ] **P7.1** Crash reporting (Sentry or equivalent) on web + mobile.
- [ ] **P7.2** Structured API error codes; no raw provider strings in user-facing UI.
- [ ] **P7.3** Backup/restore runbook for Postgres; migration discipline.
- [ ] **P7.4** Security pass: webhook signature verification if Stripe live; invite PII; disable stub billing webhook in production.
- [ ] **P7.5** Update `docs/ACCEPTANCE.md` so claimed test paths exist; add missing API integration tests under `apps/api/src/__tests__` or stop claiming them.

### Done when

- One forced crash appears in the error tracker.
- Production config checklist in `docs/ACCEPTANCE.md` is fully checked.

---

## Phase 8 — Optional later (explicitly out of MVP)

Do **not** start these until Phases 0–7 Done criteria pass unless product prioritizes them:

- Full mobile parity: goals, AI chat, OCR, invites, spaces management, reports charts.
- Google Play Billing for Plus.
- iOS App Store.
- Transfer dual-entry, scheduled expenses, approvals.
- Advanced AI features requiring always-on worker + keys.

---

## Suggested agent assignment order

| Agent wave | Phases | Parallelism |
| --- | --- | --- |
| Wave A | Phase 0 → 1 → 2 | Sequential (auth before money loop) |
| Wave B | Phase 3 + 4 | Parallel after Phase 2 |
| Wave C | Phase 5 | Needs ops/secrets from human |
| Wave D | Phase 6 | After Phase 5 API URL exists |
| Wave E | Phase 7 | After first production deploy |

Human-required inputs (agents must not invent):

- Production domain + TLS certs / hosting account
- EAS / Expo account + Play Console account
- Privacy policy legal text (or approved draft)
- Stripe live keys (only if enabling paid)
- Google OAuth production client IDs
- AI provider key (optional; app must work without it)

---

## Open blockers

| ID | Blocker | Owner |
| --- | --- | --- |
| B1 | Production host / domain not chosen | Human |
| B2 | Play Console + EAS accounts | Human |
| B3 | Privacy/terms legal copy | Human |
| B4 | Whether v1 Android is free-only | Human (recommend: yes) |

---

## Definition of “production ready”

Ship is allowed when:

1. Phases **0–5** Done criteria are met (web production).
2. Phase **6** Done criteria are met for **Closed Testing** (Android).
3. Phase **7** P7.4–P7.5 complete (security + acceptance honesty).
4. Core ledger works with AI/OCR/billing **off**.
5. No tracked secrets; `APP_ENV=production` uses secure cookies and no impersonation header.
