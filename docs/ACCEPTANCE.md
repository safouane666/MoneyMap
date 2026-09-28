# Clear Money acceptance matrix

Maps every acceptance requirement from the Clear Money execution plan to an automated test file or a manual checklist item. Keep this file updated when adding coverage.

Legend:

| Status | Meaning |
| --- | --- |
| Automated | Covered by a committed test |
| Manual | Device / visual / ops checklist |
| Partial | Automated core; UI or device follow-up remains |

---

## Phase 1 — Domain

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| D1 | Money arithmetic uses minor units, no floats | Automated | `packages/domain/src/domain.test.ts` |
| D2 | TND (3-decimal) and JPY (0-decimal) parse/format | Automated | `packages/domain/src/domain.test.ts` |
| D3 | Excess decimals rejected | Automated | `packages/domain/src/domain.test.ts` |
| D4 | Net = income − expenses; transfers excluded | Automated | `packages/domain/src/domain.test.ts` |
| D5 | Drafts excluded from totals | Automated | `packages/domain/src/domain.test.ts` |
| D6 | Time insights use `occurredAt` timezone; min sample | Automated | `packages/domain/src/domain.test.ts` |
| D7 | Late entry = createdAt > 48h after occurredAt | Automated | `packages/domain/src/domain.test.ts` |
| D8 | Safe-to-spend formula + missing-input message | Automated | `packages/domain/src/domain.test.ts` |
| D9 | Permissions matrix (Owner/Admin/Contributor/Viewer/Child) | Automated | `packages/domain/src/domain.test.ts` |
| D10 | Entitlements / plan features / Free limits | Automated | `packages/domain/src/domain.test.ts` |
| D11 | Notification planner: quiet hours, caps, dedupe, stale | Automated | `packages/domain/src/domain.test.ts` |
| D12 | Preview modes full / summary / generic | Automated | `packages/domain/src/domain.test.ts` |
| D13 | Locale direction RTL for `ar` without finite language enum in logic | Automated | `packages/domain/src/domain.test.ts`, `packages/domain/src/locale/index.ts` |

---

## Phase 2 — Schema, auth, seed

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| S1 | Migrations apply on fresh database | Manual / script | `pnpm db:migrate` against empty Postgres |
| S2 | Seed is idempotent | Partial | `packages/db/src/seed.ts` (re-run exits early) + Manual re-run |
| S3 | Viewer create/edit/invite/settings rejected; Owner allowed | Automated (API) | `apps/api/src/__tests__/**` (permissions / spaces) |
| S4 | Auth surface only unauthenticated routes besides public | Manual review | `apps/api` middleware route list |

---

## Phase 3 — API money loop

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| A1 | Report totals match income − expenses fixture | Automated | `apps/api/src/__tests__/**` report / totals |
| A2 | Offline retry same idempotency key does not duplicate | Automated | `apps/api/src/__tests__/**` transactions; `apps/mobile/src/offline/queue.test.ts` |
| A3 | Voice/receipt drafts require explicit confirm | Automated | Domain `requiresConfirmation` + API draft status tests |
| A4 | Membership filters every Space query | Automated | API membership middleware tests |

---

## Phase 4 — Browser shell

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| W1 | No horizontal overflow at 320 / 768 / 1024 / 1440 | Automated | `apps/web` Playwright (`pnpm --filter @clear-money/web e2e`) |
| W2 | Keyboard focus visible; reduced motion respected | Manual + Partial e2e | Visual QA checklist below; Playwright reduced-motion where present |
| W3 | Landing CTA above the fold | Automated / Manual | Playwright landing + Manual fold check |

---

## Phase 5 — First-run setup

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| F1 | welcome → language (`ar`) → currency (TND) → Not now → skip intro → sign-up → Home | Automated (web) / Manual (mobile) | Playwright setup flow; mobile: `apps/mobile/app/setup/*` device checklist |
| F2 | Resume mid-flow after refresh | Automated / Manual | Web setup-session tests; mobile `LocalSetupSession` AsyncStorage |
| F3 | Google OAuth cancel keeps setup choices | Automated (mocked) | Web Playwright OAuth cancel path |
| F4 | No payment / bank / invite / required first txn in setup | Manual | Setup route review (web + mobile) |
| F5 | Signed-in with `setupCompletedAt` skips setup | Automated | API / web auth gate |

---

## Phase 6 — Home, Add, Activity

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| H1 | New user records expense from Home in one flow | Automated | Playwright home add flow |
| H2 | Undo removes transaction | Automated | Playwright / API undo |
| H3 | Transfer does not change net | Automated | Domain + Playwright / API |
| H4 | Displayed totals match API fixture | Automated | Playwright + API fixture |
| H5 | Empty / loading / error / offline / permission states | Manual | Visual QA checklist |

---

## Phase 7 — Reports & exports

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| R1 | XLSX sheet set matches spec; totals = filtered report | Automated | `apps/worker/src/handlers.test.ts` (sheet list); API export integration |
| R2 | Timezone fixture uses `occurredAt`, not `createdAt` | Automated | Domain + API report tests |
| R3 | One-transaction insight returns insufficient data | Automated | `packages/domain/src/domain.test.ts` |
| R4 | Large export async with user-visible job status | Automated / Manual | Worker job status updates; Manual download UX |

---

## Phase 8 — Goals

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| G1 | Baseline safe-to-spend formula | Automated | `packages/domain/src/domain.test.ts` |
| G2 | Missing-input case | Automated | `packages/domain/src/domain.test.ts` |
| G3 | Details view lists each term | Manual / Partial | Web goals UI checklist |

---

## Phase 9 — Spaces & roles

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| P1 | API matrix for all five roles | Automated | `apps/api/src/__tests__/**` |
| P2 | Viewer sees explanation instead of create control | Manual / e2e | Web + mobile Spaces / Home |
| P3 | Child cannot read another member’s entries | Automated | API filterVisibleEntries + API tests |

---

## Phase 10 — Settings & deletion

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| X1 | Account deletion removes auth access and personal data | Automated | API deletion tests |
| X2 | Shared-Space records remain; actor detached | Automated | API deletion tests |
| X3 | Display currency change leaves `amountMinor` unchanged | Automated | Domain format vs store + API settings test |

---

## Phase 11 — Billing

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| B1 | Free-only / disabled config renders no payment UI | Automated | Domain `buildPublicBillingConfig` + web billing tests |
| B2 | Sandbox rejects live Stripe credentials | Automated | API billing config tests |
| B3 | Webhook fixture flips Plus entitlement | Automated | API Stripe webhook tests |
| B4 | Free user can still read/write core transactions | Automated | API entitlements + transaction tests |
| B5 | `BETA_FREE_MODE` hides upgrade CTAs | Manual + Automated | Public config projection |

---

## Phase 12 — Receipts, voice, AI

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| I1 | Unconfirmed OCR/AI draft absent from totals | Automated | Domain drafts + `apps/worker/src/handlers.test.ts` (`requiresConfirmation`) |
| I2 | Confirmed draft matches edited fields | Automated | API confirm transaction tests |
| I3 | Provider outage still allows manual save | Automated | Worker fails job when `AI_API_KEY` missing; core API independent |
| I4 | Prompt / draft contains only structured minimized data | Partial | Fake AI provider narrative + caveats in worker |
| I5 | OCR returns per-field confidence draft | Automated | `apps/worker/src/handlers.test.ts` |

---

## Phase 13 — Mobile apps

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| M1 | Four-tab shell + FAB Add | Manual | `apps/mobile` device checklist in README |
| M2 | Setup + auth deep links | Manual | Expo scheme `clearmoney://` |
| M3 | Offline expense → reconnect without duplicate | Automated + Manual | `apps/mobile/src/offline/queue.test.ts` + Maestro/Detox smoke |
| M4 | Safe areas / 48dp targets | Manual | Device checklist |
| M5 | Amount conflict surfaces review | Automated | `apps/mobile/src/offline/queue.test.ts` |

---

## Phase 14 — Device-local notifications

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| N1 | Planner rules (domain) | Automated | `packages/domain/src/domain.test.ts` |
| N2 | Schedule rebuild replaces rather than appends | Automated | `apps/mobile/src/notifications/planner-adapter.test.ts` |
| N3 | Permission denied still completes tracking | Manual | Setup “Not now” + add transaction |
| N4 | Disabled prefs cancel all scheduled | Automated | `planner-adapter.test.ts` |

---

## Phase 15 — Cross-cutting acceptance

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| C1 | Entry speed (add amount-first) | Manual | Web dialog + mobile modal |
| C2 | Totals vs export parity | Automated | API + worker export |
| C3 | Locale / RTL / decimal currencies | Automated + Manual | Domain, i18n, mobile language screen |
| C4 | Core app works when AI / OCR / billing / export down | Automated | Worker graceful fail; billing disabled mode; Manual kill worker |
| C5 | Free users never blocked from core data | Automated | Entitlements + API |
| C6 | i18n English fallback for unknown locales | Automated | `packages/i18n/src/i18n.test.ts` |

---

## i18n package

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| L1 | Ship `en`, `fr`, `ar` bundles | Automated | `packages/i18n/src/i18n.test.ts` |
| L2 | `t(locale, key, params?)` with English fallback | Automated | `packages/i18n/src/i18n.test.ts` |
| L3 | Matching key coverage across bundles | Automated | `packages/i18n/src/i18n.test.ts` |

---

## Worker jobs

| ID | Acceptance | Coverage | Location |
| --- | --- | --- | --- |
| J1 | `ocr_receipt` draft + confirmation required | Automated | `apps/worker/src/handlers.test.ts` |
| J2 | `ai_monthly_report` fails gracefully without `AI_API_KEY` | Automated | `apps/worker/src/handlers.test.ts` |
| J3 | `export_xlsx` / `export_pdf` produce artifacts metadata | Automated | `apps/worker/src/handlers.test.ts` |
| J4 | Job status updates queued → running → succeeded/failed | Manual / integration | Run worker against Postgres jobs table |
| J5 | Idempotent re-process of succeeded jobs | Partial | `apps/worker/src/jobs.ts` `processJob` / idempotency lookup |

---

## Visual QA (manual)

Run on web (320–1440) and one phone each OS:

- [ ] Dark mode tokens readable (ink / surfaces / borders)
- [ ] Long German/French strings do not overflow chrome
- [ ] RTL (`ar`): nav mirrored; numerals / currency / charts not mirrored
- [ ] Large amounts use tabular figures
- [ ] Empty / loading / error / offline / permission-denied on Home, Activity, Reports
- [ ] `prefers-reduced-motion` / OS reduce-motion: no non-essential motion
- [ ] Touch targets ≥ 44pt / 48dp on mobile

---

## Billing matrix (manual + automated)

| Mode | Expectation | Check |
| --- | --- | --- |
| `disabled` / `BETA_FREE_MODE=true` | No checkout, upgrade CTA, paid badge, paywall | Automated public config + Manual UI |
| `sandbox` | Test price IDs only; banner visible | Automated + Manual |
| `live` | Production only; verified webhooks | Manual production checklist |

---

## First-run device checklist (manual)

### Browser

- [ ] Full setup path including `ar` + TND
- [ ] Resume after refresh mid-setup
- [ ] OAuth cancel keeps locale/currency
- [ ] No payment UI in setup

### Android

- [ ] Install via Expo Go or build
- [ ] Setup → sign-up → Home
- [ ] Offline expense → airplane mode off → no duplicate
- [ ] Notification permission only after Enable
- [ ] Safe area + FAB

### iOS

- [ ] Same as Android on simulator or device
- [ ] Deep link into Add / Reports does not leak Space data when signed out

---

## Demo login (manual review)

After `pnpm db:seed`, use the seeded demo owner documented in `packages/db/src/seed.ts` (email `demo@clearmoney.app` when present). Confirm Personal / Project / Family / Company Spaces, multi-currency, child role, and transfers appear.

---

## Production config checklist (manual)

- [ ] `APP_ENV=production` before live Stripe
- [ ] Live Stripe keys only in production; no test keys
- [ ] Webhooks verified and audited
- [ ] Rate limits on for auth, invites, AI, OCR, export
- [ ] `AI_API_KEY` optional — app boots without it
- [ ] Object storage private; signed URLs short-lived

---

## How to run automated suites

```bash
pnpm --filter @clear-money/domain test
pnpm --filter @clear-money/i18n test
pnpm --filter @clear-money/worker test
pnpm --filter @clear-money/mobile test
pnpm --filter @clear-money/db test
pnpm --filter @clear-money/api test
pnpm --filter @clear-money/web test
pnpm --filter @clear-money/web e2e
pnpm typecheck
pnpm test
```
