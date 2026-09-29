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

**Done when**
- [x] Create goal UI collects duration; shows monthly amount and colored progress.
- [x] Domain helpers unit-tested for monthly expected and final win/lose.
- [x] Penny tool `create_goal` / `plan_goal` available.
- [x] Worker periodically evaluates active goals (`evaluateActiveGoals`).

## F2 — Home salary & subscriptions (recurring)

**Product**
- Home top section: **Income** (salary etc.) and **Subscriptions** lists.
- CRUD: name, amount, day of month (1–28), currency = space currency.
- Auto-post a ledger transaction on that day each month (worker or API tick).
- Device/local or in-app toast: remind **24h before** due (notification planner fact `subscription_due`).

**Done when**
- [x] API CRUD under `/spaces/:id/recurring` (scheduled_expenses extended: kind, day_of_month, active, last_posted_at, notify_hours_before, created_by).
- [x] Worker `post_due_recurring` posts due items idempotently (same UTC calendar month skipped); poll sweep + job type; `POST .../recurring/tick` for manual test.
- [x] Home UI manage sheet works signed-in.
- [x] 24h-before toast on Home + planner category `subscription_due`.

## F3 — Activity month/year + export

**Product**
- Activity filters by month + year.
- Export CSV of the **filtered** list.

**Done when**
- [x] MonthYearFilter on Activity + ExportDialog uses filtered rows.

## F4 — Reports saves + filters + export

**Product**
- Show **overall saves** (income − expenses for filter, aka net, labeled as saves when positive).
- Filter by this month / last month / custom month-year / optional custom range.
- Export respects active filters.

**Done when**
- [x] Saves card + PeriodSelector / pick-month + filtered export.

---

After F1–F4, resume VPS deploy testing (`docs/DEPLOY_VPS.md`).
Apply migration `packages/db/drizzle/0002_goals_recurring.sql` before deploy.
