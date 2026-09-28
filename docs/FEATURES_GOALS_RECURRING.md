# Feature pack — Goals pacing, recurring money, filtered activity/reports

Agent-executable add-on before VPS deploy. Do **not** block deploy scaffolding on mobile icons/EAS.

## F1 — Duration goals + monthly split + win/lose + colors

**Product**
- User sets target (e.g. Gaming PC $2000) and **duration in months** (e.g. 3).
- Monthly target = `ceil(targetMinor / durationMonths)` (last month may be smaller remainder).
- Progress from `startDate` → `targetDate` (= start + duration months).
- **Monthly checkpoint** (on the day-of-month matching start, or 1st): compare `savedMinor` vs expected cumulative; mark month win/lose for pacing.
- **Final**: at end of duration, goal `won` if `savedMinor >= targetMinor`, else `lost`.
- Progress bar colors: ahead/on_track → income green; tight → warning; behind/lost → expense red; won → brand/income.
- Penny can plan and create goals (AI tools).
- Notifications when pace is **tight** or **behind** (`notificationPolicy` + planner category `savings_goal`).

**Checklist**
- [x] Domain: `Goal` duration fields + `monthlyTargetMinor` / `expectedSavedByDate` / `evaluateGoalPace` (unit-tested)
- [x] DB: `start_date`, `duration_months`, `pace_status` migration + schema
- [x] API: POST/PATCH/GET goals accept duration fields; optional `POST .../goals/:id/evaluate`
- [ ] Create goal UI collects duration; shows monthly amount and colored progress
- [ ] Penny tool `create_goal` / `plan_goal` available

**Done when**
- Create goal UI collects duration; shows monthly amount and colored progress.
- Domain helpers unit-tested for monthly expected and final win/lose.
- Penny tool `create_goal` / `plan_goal` available.

## F2 — Home salary & subscriptions (recurring)

**Product**
- Home top section: **Income** (salary etc.) and **Subscriptions** lists.
- CRUD: name, amount, day of month (1–28), currency = space currency.
- Auto-post a ledger transaction on that day each month (worker or API tick).
- Device/local or in-app toast: remind **24h before** due (notification planner fact `subscription_due`).

**Done when**
- API CRUD under `/spaces/:id/recurring` (or scheduled expenses extended).
- Worker posts due items idempotently.
- Home UI manage sheet works signed-in.

## F3 — Activity month/year + export

**Product**
- Activity filters by month + year.
- Export CSV of the **filtered** list.

## F4 — Reports saves + filters + export

**Product**
- Show **overall saves** (income − expenses for filter, aka net, labeled as saves when positive).
- Filter by this month / last month / custom month-year / optional custom range.
- Export respects active filters.

---

## Checklist

- [ ] F1 domain + API (duration, monthly split, pace evaluate)
- [ ] F1 web goals UI + colored progress + Penny tools
- [x] F3 Activity month/year filter + filtered export
- [x] F4 Reports overall saves + month pick + filtered export
- [ ] F2 recurring schema + API + worker tick
- [ ] F2 Home salary/subscriptions UI + 24h reminder hooks

After F1–F4, resume VPS deploy testing (`docs/DEPLOY_VPS.md`).
