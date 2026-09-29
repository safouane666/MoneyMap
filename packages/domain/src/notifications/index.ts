export type NotificationCategory =
  | 'daily_spend_fact'
  | 'daily_mini_report'
  | 'time_pattern'
  | 'category_change'
  | 'savings_goal'
  | 'subscription_due'
  | 'safe_to_spend'
  | 'weekly_review'
  | 'gentle_inactivity';

export type PreviewMode = 'full' | 'summary' | 'generic';

export interface NotificationPreference {
  userId: string;
  enabled: boolean;
  categories: NotificationCategory[];
  quietHoursStart: number;
  quietHoursEnd: number;
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

const MIN_SAMPLE = 5;
const DEFAULT_SUBSCRIPTION_NOTIFY_HOURS = 24;

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

/** Savings goal reminders only when pacing is tight or behind (not on track / ahead). */
export function shouldPlanSavingsGoalNotification(
  facts: Record<string, string | number>,
): boolean {
  const pace = facts.goalPace;
  if (pace === 'tight' || pace === 'behind') return true;
  if (isTruthyFact(facts, 'goalTight')) return true;
  return false;
}

/** Subscription renewal reminder within the configured notify window (default 24h). */
export function shouldPlanSubscriptionDueNotification(
  facts: Record<string, string | number>,
): boolean {
  if (isTruthyFact(facts, 'subscriptionDueSoon')) return true;
  const hoursUntil = factNumber(facts, 'hoursUntilSubscriptionDue');
  if (hoursUntil === null) return false;
  const window =
    factNumber(facts, 'subscriptionNotifyHoursBefore') ?? DEFAULT_SUBSCRIPTION_NOTIFY_HOURS;
  return hoursUntil >= 0 && hoursUntil <= window;
}

function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function fingerprint(type: NotificationCategory, spaceId: string, period: string): string {
  return `${type}:${spaceId}:${period}`;
}

/**
 * Pure planner: builds a schedule diff from preferences + local snapshot.
 * Engagement notifications are device-local — never server cron.
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

  const candidates: PlannedNotification[] = [];

  const add = (
    type: NotificationCategory,
    titleKey: string,
    destination: string,
    requireSample: boolean,
  ) => {
    if (!prefs.categories.includes(type)) return;
    if (requireSample && snapshot.sampleSize < MIN_SAMPLE) return;
    candidates.push({
      type,
      spaceId: snapshot.spaceId,
      scheduledAt: nowIso,
      titleKey,
      bodyPayload: snapshot.facts,
      destination,
      fingerprint: fingerprint(type, snapshot.spaceId, snapshot.periodLabel),
    });
  };

  add('daily_mini_report', 'notif.daily_mini_report', '/app/reports', false);
  add('daily_spend_fact', 'notif.daily_spend_fact', '/app/reports', true);
  add('time_pattern', 'notif.time_pattern', '/app/reports?tab=time', true);
  add('category_change', 'notif.category_change', '/app/reports?tab=categories', true);
  if (shouldPlanSavingsGoalNotification(snapshot.facts)) {
    add('savings_goal', 'notif.savings_goal', '/app/goals', false);
  }
  if (shouldPlanSubscriptionDueNotification(snapshot.facts)) {
    add('subscription_due', 'notif.subscription_due', '/app/home', false);
  }
  add('safe_to_spend', 'notif.safe_to_spend', '/app/goals', false);
  add('gentle_inactivity', 'notif.gentle_inactivity', '/app/home', false);
  add('weekly_review', 'notif.weekly_review', '/app/reports', false);

  const daily = candidates
    .filter((s) => s.type !== 'weekly_review')
    .slice(0, Math.max(0, prefs.maxDaily));
  const weekly = candidates
    .filter((s) => s.type === 'weekly_review')
    .slice(0, Math.max(0, prefs.maxWeeklyReviews));
  const schedule = [...daily, ...weekly];

  // Rebuild: cancel anything not in the new schedule (replace, do not append duplicates)
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
  return 'Your Clear Money update is ready.';
}

/**
 * Build planner facts for savings-goal pace + subscription renewals.
 * Callers merge into NotificationSnapshot.facts before planNotifications.
 */
export function buildEngagementFacts(input: {
  goals?: Array<{ paceStatus?: string; notificationPolicy?: string; status?: string }>;
  recurring?: Array<{
    nextDueAt?: string | null;
    notifyHoursBefore?: number | null;
    active?: boolean;
  }>;
  now?: Date;
}): Record<string, string | number> {
  const now = input.now ?? new Date();
  const facts: Record<string, string | number> = {};

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

  let soonestHours: number | null = null;
  let notifyWindow = DEFAULT_SUBSCRIPTION_NOTIFY_HOURS;
  for (const item of input.recurring ?? []) {
    if (item.active === false || !item.nextDueAt) continue;
    const dueMs = new Date(item.nextDueAt).getTime();
    if (!Number.isFinite(dueMs)) continue;
    const hours = (dueMs - now.getTime()) / 3_600_000;
    if (hours < 0) continue;
    const window = item.notifyHoursBefore ?? DEFAULT_SUBSCRIPTION_NOTIFY_HOURS;
    if (soonestHours === null || hours < soonestHours) {
      soonestHours = hours;
      notifyWindow = window;
    }
  }
  if (soonestHours !== null) {
    facts.hoursUntilSubscriptionDue = Math.round(soonestHours * 10) / 10;
    facts.subscriptionNotifyHoursBefore = notifyWindow;
    if (soonestHours <= notifyWindow) facts.subscriptionDueSoon = 1;
  }

  return facts;
}
