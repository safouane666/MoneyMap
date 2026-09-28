import type { LedgerTransaction } from './totals.js';
import { isLateEntry } from './totals.js';

export const MIN_INSIGHT_SAMPLE = 5;

export interface TimeInsight {
  kind: 'busiest_hour' | 'highest_weekday' | 'late_entries' | 'time_trend' | 'insufficient';
  message: string;
  sampleSize: number;
  confidence: 'high' | 'low' | 'none';
  data?: Record<string, number | string>;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function localParts(iso: string, timeZone: string): { hour: number; weekday: number } {
  const d = new Date(iso);
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  });
  const weekdayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const hour = Number(hourFmt.format(d));
  const wd = weekdayFmt.format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hour: hour === 24 ? 0 : hour, weekday: map[wd] ?? 0 };
}

export function busiestSpendingHour(
  transactions: LedgerTransaction[],
  timeZone: string,
): TimeInsight {
  const expenses = transactions.filter((t) => t.status === 'confirmed' && t.type === 'expense');
  if (expenses.length < MIN_INSIGHT_SAMPLE) {
    return {
      kind: 'insufficient',
      message: 'Not enough data yet',
      sampleSize: expenses.length,
      confidence: 'none',
    };
  }
  const buckets = new Map<number, number>();
  for (const t of expenses) {
    const { hour } = localParts(t.occurredAt, timeZone);
    buckets.set(hour, (buckets.get(hour) ?? 0) + t.amountMinor);
  }
  let bestHour = 0;
  let best = -1;
  for (const [hour, total] of buckets) {
    if (total > best) {
      best = total;
      bestHour = hour;
    }
  }
  const end = (bestHour + 3) % 24;
  const pad = (h: number) => h.toString().padStart(2, '0');
  return {
    kind: 'busiest_hour',
    message: `Most spending happens from ${pad(bestHour)}:00 to ${pad(end)}:00.`,
    sampleSize: expenses.length,
    confidence: 'high',
    data: { hour: bestHour, totalMinor: best },
  };
}

export function highestSpendingWeekday(
  transactions: LedgerTransaction[],
  timeZone: string,
): TimeInsight {
  const expenses = transactions.filter((t) => t.status === 'confirmed' && t.type === 'expense');
  if (expenses.length < MIN_INSIGHT_SAMPLE) {
    return {
      kind: 'insufficient',
      message: 'Not enough data yet',
      sampleSize: expenses.length,
      confidence: 'none',
    };
  }
  const buckets = new Map<number, number>();
  for (const t of expenses) {
    const { weekday } = localParts(t.occurredAt, timeZone);
    buckets.set(weekday, (buckets.get(weekday) ?? 0) + t.amountMinor);
  }
  let bestDay = 0;
  let best = -1;
  for (const [day, total] of buckets) {
    if (total > best) {
      best = total;
      bestDay = day;
    }
  }
  return {
    kind: 'highest_weekday',
    message: `${WEEKDAYS[bestDay]} is your highest-spend day.`,
    sampleSize: expenses.length,
    confidence: 'high',
    data: { weekday: bestDay, totalMinor: best },
  };
}

export function lateEntryInsight(transactions: LedgerTransaction[]): TimeInsight {
  const confirmed = transactions.filter((t) => t.status === 'confirmed');
  const late = confirmed.filter((t) => isLateEntry(t.occurredAt, t.createdAt));
  return {
    kind: 'late_entries',
    message:
      late.length === 0
        ? 'All entries were recorded promptly.'
        : `${late.length} ${late.length === 1 ? 'entry was' : 'entries were'} added more than 48 hours later.`,
    sampleSize: confirmed.length,
    confidence: confirmed.length >= MIN_INSIGHT_SAMPLE ? 'high' : 'low',
    data: { lateCount: late.length },
  };
}

export function hourBuckets(
  transactions: LedgerTransaction[],
  timeZone: string,
): Array<{ hour: number; totalMinor: number; count: number }> {
  const map = new Map<number, { totalMinor: number; count: number }>();
  for (const t of transactions) {
    if (t.status !== 'confirmed' || t.type !== 'expense') continue;
    const { hour } = localParts(t.occurredAt, timeZone);
    const cur = map.get(hour) ?? { totalMinor: 0, count: 0 };
    cur.totalMinor += t.amountMinor;
    cur.count += 1;
    map.set(hour, cur);
  }
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalMinor: map.get(hour)?.totalMinor ?? 0,
    count: map.get(hour)?.count ?? 0,
  }));
}

export function weekdayBuckets(
  transactions: LedgerTransaction[],
  timeZone: string,
): Array<{ weekday: number; label: string; totalMinor: number; count: number }> {
  const map = new Map<number, { totalMinor: number; count: number }>();
  for (const t of transactions) {
    if (t.status !== 'confirmed' || t.type !== 'expense') continue;
    const { weekday } = localParts(t.occurredAt, timeZone);
    const cur = map.get(weekday) ?? { totalMinor: 0, count: 0 };
    cur.totalMinor += t.amountMinor;
    cur.count += 1;
    map.set(weekday, cur);
  }
  return WEEKDAYS.map((label, weekday) => ({
    weekday,
    label,
    totalMinor: map.get(weekday)?.totalMinor ?? 0,
    count: map.get(weekday)?.count ?? 0,
  }));
}
