/** Recurring salary / subscription helpers (day-of-month 1..28). */

export type RecurringKind = 'income' | 'expense';

export function clampDayOfMonth(day: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(28, Math.max(1, Math.trunc(day)));
}

function utcNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
}

/**
 * Next due date at UTC noon on `dayOfMonth`.
 * If that day this month is still today or in the future (UTC calendar), use it;
 * otherwise advance to next month.
 */
export function computeNextDueAt(dayOfMonth: number, from: Date = new Date()): Date {
  const day = clampDayOfMonth(dayOfMonth);
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const todayUtc = Date.UTC(y, m, from.getUTCDate());
  const thisMonthUtc = Date.UTC(y, m, day);
  if (thisMonthUtc >= todayUtc) {
    return utcNoon(y, m, day);
  }
  return utcNoon(y, m + 1, day);
}

/** Advance one month, preserving day-of-month (1..28). */
export function advanceNextDueAt(currentDueAt: Date, dayOfMonth: number): Date {
  const day = clampDayOfMonth(dayOfMonth);
  const y = currentDueAt.getUTCFullYear();
  const m = currentDueAt.getUTCMonth();
  return utcNoon(y, m + 1, day);
}

/** Idempotency guard: already posted in the same UTC calendar month as `now`. */
export function wasPostedThisCalendarMonth(
  lastPostedAt: Date | null | undefined,
  now: Date,
): boolean {
  if (!lastPostedAt) return false;
  return (
    lastPostedAt.getUTCFullYear() === now.getUTCFullYear() &&
    lastPostedAt.getUTCMonth() === now.getUTCMonth()
  );
}

export function recurringIdempotencyKey(scheduledId: string, at: Date): string {
  const ym = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  return `recurring:${scheduledId}:${ym}`;
}
