export type NotificationCategory =
  | 'daily_spend_fact'
  | 'daily_mini_report'
  | 'time_pattern'
  | 'category_change'
  | 'savings_goal'
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
  add('savings_goal', 'notif.savings_goal', '/app/goals', false);
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
