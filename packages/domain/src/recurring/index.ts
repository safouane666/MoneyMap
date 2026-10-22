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

export type RecurringDurationUnit = 'forever' | 'months' | 'years';

export const RECURRING_DURATION_UNITS: readonly RecurringDurationUnit[] = [
  'forever',
  'months',
  'years',
];

/** Upper bound for durationCount (e.g. 600 months / 50 years). */
export const MAX_RECURRING_DURATION_COUNT = 600;

export function isRecurringDurationUnit(v: unknown): v is RecurringDurationUnit {
  return v === 'forever' || v === 'months' || v === 'years';
}

export type RecurringDuration = {
  durationUnit: RecurringDurationUnit;
  durationCount: number | null;
};

/**
 * Validate + normalize a duration. `forever` ignores the count (null).
 * `months` / `years` need a positive integer count.
 */
export function normalizeRecurringDuration(
  unit: unknown,
  count: unknown,
): { ok: true; value: RecurringDuration } | { ok: false; error: string } {
  if (unit === undefined || unit === null) unit = 'forever';
  if (!isRecurringDurationUnit(unit)) {
    return { ok: false, error: 'durationUnit must be forever, months or years' };
  }
  if (unit === 'forever') {
    return { ok: true, value: { durationUnit: 'forever', durationCount: null } };
  }
  const n = typeof count === 'string' ? Number(count) : count;
  if (
    typeof n !== 'number' ||
    !Number.isFinite(n) ||
    n !== Math.trunc(n) ||
    n < 1 ||
    n > MAX_RECURRING_DURATION_COUNT
  ) {
    return {
      ok: false,
      error: `durationCount must be an integer between 1 and ${MAX_RECURRING_DURATION_COUNT}`,
    };
  }
  return { ok: true, value: { durationUnit: unit, durationCount: n } };
}

/** Total number of monthly postings for a duration, or null when forever. */
export function recurringDurationMonths(
  unit: RecurringDurationUnit,
  count: number | null | undefined,
): number | null {
  if (unit === 'forever' || !count || count < 1) return null;
  return unit === 'years' ? count * 12 : count;
}

/**
 * `endsAt` = due date of the LAST posting. The first posting is `firstDueAt`,
 * so N months → N postings (firstDueAt + (N - 1) months). Null when forever.
 */
export function computeRecurringEndsAt(
  firstDueAt: Date,
  dayOfMonth: number,
  unit: RecurringDurationUnit,
  count: number | null | undefined,
): Date | null {
  const months = recurringDurationMonths(unit, count);
  if (months === null) return null;
  const day = clampDayOfMonth(dayOfMonth);
  return utcNoon(firstDueAt.getUTCFullYear(), firstDueAt.getUTCMonth() + months - 1, day);
}

/** True when a posting due at `dueAt` falls after the recurring item's `endsAt`. */
export function isPastRecurringEnd(
  dueAt: Date,
  endsAt: Date | null | undefined,
): boolean {
  return !!endsAt && dueAt.getTime() > endsAt.getTime();
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
