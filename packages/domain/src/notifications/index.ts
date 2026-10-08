export type NotificationCategory =
  | 'daily_log_reminder'
  | 'weekly_review'
  | 'month_end_report'
  | 'subscription_due'
  | 'salary_due'
  | 'savings_goal'
  /** @deprecated kept for older schedules / i18n keys */
  | 'daily_spend_fact'
  | 'daily_mini_report'
  | 'time_pattern'
  | 'category_change'
  | 'safe_to_spend'
  | 'gentle_inactivity';

export type PreviewMode = 'full' | 'summary' | 'generic';

export interface NotificationPreference {
  userId: string;
  enabled: boolean;
  categories: NotificationCategory[];
  quietHoursStart: number;
  quietHoursEnd: number;
  /** Local hour for cadence reminders (default 19 = 7pm). */
  preferredHour: number;
  maxDaily: number;
  maxWeeklyReviews: number;
  previewMode: PreviewMode;
  timezone: string;
}

export interface NotificationSnapshot {
  spaceId: string;
  periodLabel: string;
  facts: Record<string, string | number>;
  sourceTimestamp: string;
  dataFreshness: 'fresh' | 'stale';
  locale: string;
  currency: string;
  sampleSize: number;
  memberSpaceIds: string[];
}

export interface PlannedNotification {
  type: NotificationCategory;
  spaceId: string;
  scheduledAt: string;
  titleKey: string;
  bodyPayload: Record<string, string | number>;
  destination: string;
  fingerprint: string;
}

export interface ScheduleDiff {
  cancelFingerprints: string[];
  schedule: PlannedNotification[];
}

/** Default production set — calm, not chatty. */
export const DEFAULT_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'daily_log_reminder',
  'weekly_review',
  'month_end_report',
  'subscription_due',
  'salary_due',
  'savings_goal',
];

const DEFAULT_DUE_NOTIFY_HOURS = 24;

function factNumber(facts: Record<string, string | number>, key: string): number | null {
  const v = facts[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isTruthyFact(facts: Record<string, string | number>, key: string): boolean {
  const v = facts[key];
  if (v === 0 || v === '0' || v === '') return false;
  return v !== undefined && v !== null;
}

export function shouldPlanSavingsGoalNotification(
  facts: Record<string, string | number>,
): boolean {
  const pace = facts.goalPace;
  if (pace === 'tight' || pace === 'behind') return true;
  if (isTruthyFact(facts, 'goalTight')) return true;
  return false;
}

export function shouldPlanSubscriptionDueNotification(
  facts: Record<string, string | number>,
): boolean {
  if (isTruthyFact(facts, 'subscriptionDueSoon')) return true;
  const hoursUntil = factNumber(facts, 'hoursUntilSubscriptionDue');
  if (hoursUntil === null) return false;
  const window =
    factNumber(facts, 'subscriptionNotifyHoursBefore') ?? DEFAULT_DUE_NOTIFY_HOURS;
  return hoursUntil >= 0 && hoursUntil <= window;
}

export function shouldPlanSalaryDueNotification(
  facts: Record<string, string | number>,
): boolean {
  if (isTruthyFact(facts, 'salaryDueSoon')) return true;
  const hoursUntil = factNumber(facts, 'hoursUntilSalaryDue');
  if (hoursUntil === null) return false;
  const window = factNumber(facts, 'salaryNotifyHoursBefore') ?? DEFAULT_DUE_NOTIFY_HOURS;
  return hoursUntil >= 0 && hoursUntil <= window;
}

/** True on the last calendar day of the month (local). */
export function isMonthEndDay(now: Date = new Date()): boolean {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return tomorrow.getDate() === 1;
}

function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO-like week label YYYY-Www (local). */
export function isoWeekLabel(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${pad2(week)}`;
}

export function dayLabel(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthLabel(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function fingerprint(type: NotificationCategory, spaceId: string, period: string): string {
  return `${type}:${spaceId}:${period}`;
}

/**
 * Pure planner: calm cadence + due-event alerts.
 * Device-local — never server cron. Callers stamp real fire times afterward.
 */
export function planNotifications(input: {
  preferences: NotificationPreference;
  snapshot: NotificationSnapshot;
  existingFingerprints: string[];
  nowIso: string;
  localHour: number;
}): ScheduleDiff {
  const { preferences: prefs, snapshot, existingFingerprints, nowIso, localHour } = input;

  if (!prefs.enabled) {
    return { cancelFingerprints: [...existingFingerprints], schedule: [] };
  }

  if (!snapshot.memberSpaceIds.includes(snapshot.spaceId)) {
    return { cancelFingerprints: [...existingFingerprints], schedule: [] };
  }

  if (inQuietHours(localHour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
    return { cancelFingerprints: [...existingFingerprints], schedule: [] };
  }

  if (snapshot.dataFreshness === 'stale') {
    return { cancelFingerprints: [...existingFingerprints], schedule: [] };
  }

  const now = new Date(nowIso);
  const dailyPeriod = dayLabel(now);
  const weeklyPeriod = isoWeekLabel(now);
  const monthlyPeriod = monthLabel(now);
  const candidates: PlannedNotification[] = [];

  const add = (
    type: NotificationCategory,
    titleKey: string,
    destination: string,
    period: string,
  ) => {
    if (!prefs.categories.includes(type)) return;
    candidates.push({
      type,
      spaceId: snapshot.spaceId,
      scheduledAt: nowIso,
      titleKey,
      bodyPayload: snapshot.facts,
      destination,
      fingerprint: fingerprint(type, snapshot.spaceId, period),
    });
  };

  // Cadence (one each)
  add('daily_log_reminder', 'notif.daily_log_reminder', '/app/home', dailyPeriod);
  // Legacy alias if older prefs still list gentle_inactivity
  if (
    prefs.categories.includes('gentle_inactivity') &&
    !prefs.categories.includes('daily_log_reminder')
  ) {
    add('gentle_inactivity', 'notif.gentle_inactivity', '/app/home', dailyPeriod);
  }
  add('weekly_review', 'notif.weekly_review', '/app/reports', weeklyPeriod);
  if (isMonthEndDay(now) || isTruthyFact(snapshot.facts, 'planMonthEnd')) {
    add('month_end_report', 'notif.month_end_report', '/app/reports', monthlyPeriod);
  }

  // Event-driven (reasonable)
  if (shouldPlanSubscriptionDueNotification(snapshot.facts)) {
    add('subscription_due', 'notif.subscription_due', '/app/home', dailyPeriod);
  }
  if (shouldPlanSalaryDueNotification(snapshot.facts)) {
    add('salary_due', 'notif.salary_due', '/app/home', dailyPeriod);
  }
  if (shouldPlanSavingsGoalNotification(snapshot.facts)) {
    add('savings_goal', 'notif.savings_goal', '/app/goals', weeklyPeriod);
  }

  const cadenceDaily = candidates.filter(
    (s) => s.type === 'daily_log_reminder' || s.type === 'gentle_inactivity',
  );
  const cadenceWeekly = candidates.filter((s) => s.type === 'weekly_review');
  const cadenceMonthly = candidates.filter((s) => s.type === 'month_end_report');
  const eventDriven = candidates.filter((s) =>
    ['subscription_due', 'salary_due', 'savings_goal'].includes(s.type),
  );

  const schedule = [
    ...cadenceDaily.slice(0, Math.max(0, prefs.maxDaily)),
    ...cadenceWeekly.slice(0, Math.max(0, prefs.maxWeeklyReviews)),
    ...cadenceMonthly.slice(0, 1),
    ...eventDriven.slice(0, 2),
  ];

  const keep = new Set(schedule.map((s) => s.fingerprint));
  const cancelFingerprints = existingFingerprints.filter((fp) => !keep.has(fp));

  return { cancelFingerprints, schedule };
}

export function formatNotificationPreview(
  mode: PreviewMode,
  fullBody: string,
  summaryBody: string,
): string {
  if (mode === 'full') return fullBody;
  if (mode === 'summary') return summaryBody;
  return 'Your Penny update is ready.';
}

/**
 * Build planner facts for savings pace + salary/subscription renewals.
 */
export function buildEngagementFacts(input: {
  goals?: Array<{ paceStatus?: string; notificationPolicy?: string; status?: string }>;
  recurring?: Array<{
    kind?: 'income' | 'expense' | string;
    nextDueAt?: string | null;
    notifyHoursBefore?: number | null;
    active?: boolean;
  }>;
  now?: Date;
  /** When true, month-end report is eligible even before last calendar day (tests). */
  forceMonthEnd?: boolean;
}): Record<string, string | number> {
  const now = input.now ?? new Date();
  const facts: Record<string, string | number> = {};

  if (input.forceMonthEnd || isMonthEndDay(now)) {
    facts.planMonthEnd = 1;
  }

  const activeGoals = (input.goals ?? []).filter((g) => !g.status || g.status === 'active');
  const worst = activeGoals.find(
    (g) =>
      (g.notificationPolicy === undefined || g.notificationPolicy !== 'off') &&
      (g.paceStatus === 'behind' || g.paceStatus === 'tight'),
  );
  if (worst?.paceStatus === 'behind' || worst?.paceStatus === 'tight') {
    facts.goalPace = worst.paceStatus;
    facts.goalTight = 1;
  }

  let soonestSub: number | null = null;
  let subWindow = DEFAULT_DUE_NOTIFY_HOURS;
  let soonestSalary: number | null = null;
  let salaryWindow = DEFAULT_DUE_NOTIFY_HOURS;

  for (const item of input.recurring ?? []) {
    if (item.active === false || !item.nextDueAt) continue;
    const dueMs = new Date(item.nextDueAt).getTime();
    if (!Number.isFinite(dueMs)) continue;
    const hours = (dueMs - now.getTime()) / 3_600_000;
    if (hours < 0) continue;
    const window = item.notifyHoursBefore ?? DEFAULT_DUE_NOTIFY_HOURS;
    const kind = item.kind ?? 'expense';
    if (kind === 'income') {
      if (soonestSalary === null || hours < soonestSalary) {
        soonestSalary = hours;
        salaryWindow = window;
      }
    } else {
      if (soonestSub === null || hours < soonestSub) {
        soonestSub = hours;
        subWindow = window;
      }
    }
  }

  if (soonestSub !== null) {
    facts.hoursUntilSubscriptionDue = Math.round(soonestSub * 10) / 10;
    facts.subscriptionNotifyHoursBefore = subWindow;
    if (soonestSub <= subWindow) facts.subscriptionDueSoon = 1;
  }
  if (soonestSalary !== null) {
    facts.hoursUntilSalaryDue = Math.round(soonestSalary * 10) / 10;
    facts.salaryNotifyHoursBefore = salaryWindow;
    if (soonestSalary <= salaryWindow) facts.salaryDueSoon = 1;
  }

  return facts;
}

/** Next local fire time at preferredHour (defaults to tomorrow if already past today). */
export function nextAtHour(preferredHour: number, from = new Date()): Date {
  const at = new Date(from);
  at.setSeconds(0, 0);
  at.setMinutes(0);
  at.setHours(preferredHour);
  if (at.getTime() <= from.getTime() + 60_000) {
    at.setDate(at.getDate() + 1);
  }
  return at;
}

/** Next Sunday (or today if Sunday and still before hour) at preferredHour. */
export function nextWeeklyAt(preferredHour: number, from = new Date()): Date {
  const at = nextAtHour(preferredHour, from);
  // 0 = Sunday
  while (at.getDay() !== 0) {
    at.setDate(at.getDate() + 1);
  }
  if (at.getTime() <= from.getTime() + 60_000) {
    at.setDate(at.getDate() + 7);
  }
  return at;
}

/** Last day of this month (or next month if already past today's preferred hour on last day). */
export function nextMonthEndAt(preferredHour: number, from = new Date()): Date {
  const at = new Date(from.getFullYear(), from.getMonth() + 1, 0, preferredHour, 0, 0, 0);
  if (at.getTime() <= from.getTime() + 60_000) {
    return new Date(from.getFullYear(), from.getMonth() + 2, 0, preferredHour, 0, 0, 0);
  }
  return at;
}

/** Stamp planner output onto calm fire times. */
export function stampNotificationTimes(
  schedule: PlannedNotification[],
  preferredHour: number,
  from = new Date(),
): PlannedNotification[] {
  const dailyAt = nextAtHour(preferredHour, from);
  const weeklyAt = nextWeeklyAt(preferredHour, from);
  const monthAt = nextMonthEndAt(preferredHour, from);
  const eventAt = nextAtHour(preferredHour, from);

  return schedule.map((item) => {
    let when = eventAt;
    if (item.type === 'daily_log_reminder' || item.type === 'gentle_inactivity') {
      when = dailyAt;
    } else if (item.type === 'weekly_review') {
      when = weeklyAt;
    } else if (item.type === 'month_end_report') {
      when = monthAt;
    }
    return { ...item, scheduledAt: when.toISOString() };
  });
}
