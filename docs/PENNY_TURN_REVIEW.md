# Penny turn review (P5)

Scope: `buildSystemPrompt` / `AI_TOOLS` in `apps/web/src/lib/ai/tools.ts`, `stripUnsafeDeletes` in `apps/web/src/lib/ai/chat.ts`, and a read-only sample of `penny_turns` on the VPS (`moneymap-postgres`, queried 2026-10-19 over the existing SSH deploy access; aggregates plus a 30-row truncated sample, no user ids).

## DB sample

- 84 user turns / 84 assistant turns since 2026-09-29. Locales: 76 `en`, 8 `fr`. Avg assistant latency about 4.8 s, max about 39.6 s.
- 10 assistant turns have `status=error`, `error_code=ai_provider`.
- `flags.actionCount`: 0 on 49 turns, 1 on 16, 2 on 5, 9 on 1, null on 13 (turns logged before the flag existed).

## Failure modes (code review + sample)

| # | Failure mode | Evidence | Fix in P5 |
|---|--------------|----------|-----------|
| 1 | **Invented analytics.** "Where did most of my money go?", "Am I on pace?", "How much can I safely spend?" got confident answers (merchants, `$1,850 of $5,000`) with no tool call. `get_report` only returned totals and 5 recent rows, and the report intent regex only matched "how much/summary/report/balance/totals". | Sample replies with `actionCount` null/0 | `get_report` now takes `period` and `chart` and returns category, trend and hour series. Prompt requires it for spend/trend questions. The regex also matches breakdown/trend/chart/biggest/where-did-it-go. |
| 2 | **Claims success with no action.** "Done — logged…", "All set.", "The expense… has been logged" with `actionCount` 0. | Sample + `fallbackReply` generic "All set." | Prompt: never say saved/deleted/done without that tool call. Existing `claimsLedgerSave` override stays. |
| 3 | **Delete stripped but reply still says deleted.** `stripUnsafeDeletes` drops the action when `looksLikeDeleteIntent` is false (it needs a verb plus a noun such as expense/category). "remove both of theme", "any one with no emoji" are stripped, yet the model replied "I've deleted both…". | Sample | `chat.ts` now replaces the reply with a localized "I haven't deleted anything" when a delete/hide was stripped. |
| 4 | **Bulk destructive turns.** One turn produced 9 actions ("delete all custom categories… no emoji"). `looksLikeDeleteIntent` allows any `category` noun, so "delete all categories" passes. | `actionCount` 9 | Prompt: never bulk-delete; list candidates and ask; one at a time. (Not enforced in code — see follow-ups.) |
| 5 | **Wrong currency.** Replies say `$3.00` / "USD" in a TND space; the user had to correct "tnd not dollar". Shorthand like "dt", "dnts", "dinar" is not understood. The old prompt only said "never assume USD". | Sample | Prompt states the space currency, bans `$` unless USD, and treats local shorthand as the space currency. |
| 6 | **Multi-turn amount loss.** After a category question the model asks for the amount again ("enter the amount for the coffee…") instead of reusing the earlier one. History is only the last 6–8 messages. | Sample (coffee thread) | Prompt: reuse the amount from the previous message when the user answers with a category word. |
| 7 | **Hallucinated product UI.** "Navigate to the 'Reports' section in Clear Money". The app is MoneyMap with tabs Home / Activity / Goals / Reports. | Sample | Prompt names the app and tabs and says not to describe unknown screens. |
| 8 | **Tool-less chatter on ledger intents.** "Sure, I can help… confirm amount and category" instead of `ask_for_category`. `tool_choice: required` is only used when `looksLikeLedgerIntent` matches. Parse failures ("12 dt cake", "2,5 dnts coffe") rely on the deterministic fallback. | Sample | Prompt reinforces tool use. Fallback unchanged. |
| 9 | **Goal / recurring questions answered from memory.** Context only carries 4 goals in the prompt and 12 in context, and the model quoted goal pace from nowhere. | Sample | Prompt: `list_goals` / `list_recurring` first. |
| 10 | **Reply language and category names.** Prompt says to reply in the locale, but category names come from the ledger as stored (often English). | Code review | Chart "Other" label and chart titles are localized. Category names are still ledger strings. |
| 11 | **Provider errors and latency.** 10 `ai_provider` errors. Max latency is about 40 s with a 120 s timeout and up to 6 tool rounds. `reasoning_content` fallback can leak a thinking fragment as the reply. | DB + `chat.ts` | Not changed. Needs provider-side work. |
| 12 | **Report text is English-only.** `get_report` body labels ("Income:", "Expenses:") are hard-coded English even for fr/ar users. | Code review | Not changed. The chart UI uses i18n keys. |

## Limits of the new charts

- Series are built from up to 400 compact rows (`context.txns`, newest first) sent by web and mobile. `thisYear` and `allTime` are only as long as that window.
- `reportSnapshot` uses the server clock for period boundaries. The client `timeZone` is only used for hour-of-day buckets.
- Older clients that do not send `txns` still work and get totals only (`seriesAvailable: false`, no chart).

## Follow-ups (not done)

- Enforce a per-turn cap on destructive actions in `chat.ts` (the prompt asks for it, code does not).
- Tighten `looksLikeDeleteIntent` so "delete all/most/everything" needs confirmation.
- Log `actionTypes` (now added to the penny log `flags`) and re-sample after a week to confirm failure modes 1–3 dropped.
- Localize the `get_report` body text.
