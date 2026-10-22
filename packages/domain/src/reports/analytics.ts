import type { LedgerTransaction } from './totals.js';
import { computePeriodTotals, type PeriodTotals } from './totals.js';

/** Report / home period presets (extended for long-range reports). */
export type ReportPeriod =
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'thisYear'
  | 'allTime';

/** Ordered zoom steps for pinch / segmenter (narrow → wide). */
export const REPORT_PERIOD_ZOOM: readonly ReportPeriod[] = [
  'thisMonth',
  'last3Months',
  'thisYear',
  'allTime',
] as const;

export type CategoryBreakdownRow = {
  categoryId: string | null;
  /** Display name when known; callers may localize separately. */
  name: string;
  amountMinor: number;
  share: number;
};

export type TrendPoint = {
  /** ISO date (YYYY-MM-DD) bucket start. */
  date: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

export type HourBucket = {
  hour: number;
  amountMinor: number;
  count: number;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive range [start, end) in local time. */
export function rangeForReportPeriod(
  period: ReportPeriod,
  now = new Date(),
): { start: Date; end: Date } | null {
  const end = addDays(startOfLocalDay(now), 1);
  if (period === 'allTime') return null;
  if (period === 'thisWeek') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = startOfLocalDay(addDays(now, mondayOffset));
    return { start, end };
  }
  if (period === 'thisMonth') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }
  if (period === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLast = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: endLast };
  }
  if (period === 'last3Months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { start, end };
  }
  if (period === 'thisYear') {
    return { start: new Date(now.getFullYear(), 0, 1), end };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
}

export function filterTransactionsByPeriod(
  transactions: LedgerTransaction[],
  period: ReportPeriod,
  now = new Date(),
): LedgerTransaction[] {
  const range = rangeForReportPeriod(period, now);
  if (!range) return transactions;
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  return transactions.filter((t) => {
    const ms = Date.parse(t.occurredAt);
    return Number.isFinite(ms) && ms >= startMs && ms < endMs;
  });
}

export function filterByCategory(
  transactions: LedgerTransaction[],
  categoryId: string | null | 'all',
): LedgerTransaction[] {
  if (!categoryId || categoryId === 'all') return transactions;
  return transactions.filter((t) => t.categoryId === categoryId);
}

export function categoryBreakdown(
  transactions: LedgerTransaction[],
  currency: string,
  nameFor: (categoryId: string | null) => string,
  type: 'expense' | 'income' = 'expense',
): CategoryBreakdownRow[] {
  const map = new Map<string | null, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.status !== 'confirmed' || t.currency !== currency || t.type !== type) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountMinor);
    total += t.amountMinor;
  }
  const rows: CategoryBreakdownRow[] = [...map.entries()]
    .map(([categoryId, amountMinor]) => ({
      categoryId,
      name: nameFor(categoryId),
      amountMinor,
      share: total > 0 ? amountMinor / total : 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
  return rows;
}

export function spendingByHourOfDay(
  transactions: LedgerTransaction[],
  currency: string,
  timeZone = 'UTC',
): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    amountMinor: 0,
    count: 0,
  }));
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  });
  for (const t of transactions) {
    if (t.status !== 'confirmed' || t.currency !== currency || t.type !== 'expense') continue;
    const hour = Number(hourFmt.format(new Date(t.occurredAt)));
    const h = hour === 24 ? 0 : hour;
    if (h < 0 || h > 23) continue;
    buckets[h]!.amountMinor += t.amountMinor;
    buckets[h]!.count += 1;
  }
  return buckets;
}

export function incomeExpenseTrend(
  transactions: LedgerTransaction[],
  currency: string,
  period: ReportPeriod,
  now = new Date(),
): TrendPoint[] {
  const filtered = filterTransactionsByPeriod(transactions, period, now);
  const byDay = new Map<string, { incomeMinor: number; expenseMinor: number }>();

  for (const t of filtered) {
    if (t.status !== 'confirmed' || t.currency !== currency) continue;
    if (t.type !== 'income' && t.type !== 'expense') continue;
    const day = isoDay(new Date(t.occurredAt));
    const row = byDay.get(day) ?? { incomeMinor: 0, expenseMinor: 0 };
    if (t.type === 'income') row.incomeMinor += t.amountMinor;
    else row.expenseMinor += t.amountMinor;
    byDay.set(day, row);
  }

  // For long ranges, roll up by month.
  if (period === 'last3Months' || period === 'thisYear' || period === 'allTime') {
    const byMonth = new Map<string, { incomeMinor: number; expenseMinor: number }>();
    for (const [day, row] of byDay) {
      const month = day.slice(0, 7);
      const agg = byMonth.get(month) ?? { incomeMinor: 0, expenseMinor: 0 };
      agg.incomeMinor += row.incomeMinor;
      agg.expenseMinor += row.expenseMinor;
      byMonth.set(month, agg);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date: `${date}-01`,
        incomeMinor: row.incomeMinor,
        expenseMinor: row.expenseMinor,
        netMinor: row.incomeMinor - row.expenseMinor,
      }));
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({
      date,
      incomeMinor: row.incomeMinor,
      expenseMinor: row.expenseMinor,
      netMinor: row.incomeMinor - row.expenseMinor,
    }));
}

export function reportSnapshot(
  transactions: LedgerTransaction[],
  currency: string,
  period: ReportPeriod,
  nameFor: (categoryId: string | null) => string,
  opts?: { categoryId?: string | null | 'all'; timeZone?: string; now?: Date },
): {
  period: ReportPeriod;
  totals: PeriodTotals;
  categories: CategoryBreakdownRow[];
  trend: TrendPoint[];
  hours: HourBucket[];
  avgDailyExpenseMinor: number;
  topCategory: CategoryBreakdownRow | null;
} {
  const now = opts?.now ?? new Date();
  let scoped = filterTransactionsByPeriod(transactions, period, now);
  scoped = filterByCategory(scoped, opts?.categoryId ?? 'all');
  const totals = computePeriodTotals(scoped, currency);
  const categories = categoryBreakdown(scoped, currency, nameFor, 'expense');
  const trend = incomeExpenseTrend(transactions, currency, period, now);
  const hours = spendingByHourOfDay(scoped, currency, opts?.timeZone ?? 'UTC');
  const range = rangeForReportPeriod(period, now);
  let days = 1;
  if (range) {
    days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000));
  } else if (scoped.length) {
    const times = scoped.map((t) => Date.parse(t.occurredAt)).filter(Number.isFinite);
    if (times.length) {
      days = Math.max(
        1,
        Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1,
      );
    }
  }
  return {
    period,
    totals,
    categories,
    trend,
    hours,
    avgDailyExpenseMinor: Math.round(totals.expenseMinor / days),
    topCategory: categories[0] ?? null,
  };
}

export function zoomPeriod(current: ReportPeriod, direction: 'in' | 'out'): ReportPeriod {
  const idx = REPORT_PERIOD_ZOOM.indexOf(current as (typeof REPORT_PERIOD_ZOOM)[number]);
  if (idx < 0) {
    return direction === 'out' ? 'last3Months' : 'thisMonth';
  }
  if (direction === 'out') {
    return REPORT_PERIOD_ZOOM[Math.min(REPORT_PERIOD_ZOOM.length - 1, idx + 1)]!;
  }
  return REPORT_PERIOD_ZOOM[Math.max(0, idx - 1)]!;
}
