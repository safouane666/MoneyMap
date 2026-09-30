/**
 * Device-local notification sync for Clear Money.
 * Rebuilds on app open / enable / settings; optional dense test burst for QA.
 */
import {
  buildEngagementFacts,
  type NotificationCategory,
  type NotificationPreference,
  type NotificationSnapshot,
} from '@clear-money/domain';
import { AppState, type AppStateStatus } from 'react-native';
import { t } from '../lib/i18n';
import { loadLedger } from '../lib/ledger';
import { loadSetupSession } from '../lib/setup-session';
import {
  createExpoNotificationScheduler,
  requestNotificationPermission,
  scheduleNotificationBurst,
} from './expo-scheduler';
import { rebuildNotificationSchedule } from './planner-adapter';

export const ALL_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'daily_spend_fact',
  'daily_mini_report',
  'time_pattern',
  'category_change',
  'savings_goal',
  'subscription_due',
  'safe_to_spend',
  'weekly_review',
  'gentle_inactivity',
];

const TITLE_KEYS: Record<NotificationCategory, string> = {
  daily_spend_fact: 'notifications.dailySpendFact',
  daily_mini_report: 'notifications.dailyMiniReport',
  time_pattern: 'notifications.timePattern',
  category_change: 'notifications.categoryChange',
  savings_goal: 'notifications.savingsGoal',
  subscription_due: 'notifications.subscriptionDue',
  safe_to_spend: 'notifications.safeToSpend',
  weekly_review: 'notifications.weeklyReview',
  gentle_inactivity: 'notifications.gentleInactivity',
};

const BODY_KEYS: Record<NotificationCategory, string> = {
  daily_spend_fact: 'notifications.body.dailySpendFact',
  daily_mini_report: 'notifications.body.dailyMiniReport',
  time_pattern: 'notifications.body.timePattern',
  category_change: 'notifications.body.categoryChange',
  savings_goal: 'notifications.body.savingsGoal',
  subscription_due: 'notifications.body.subscriptionDue',
  safe_to_spend: 'notifications.body.safeToSpend',
  weekly_review: 'notifications.body.weeklyReview',
  gentle_inactivity: 'notifications.body.gentleInactivity',
};

let syncing = false;
let appStateSub: { remove: () => void } | null = null;

function periodLabel(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextPreferredAt(preferredHour: number, from = new Date()): Date {
  const at = new Date(from);
  at.setSeconds(0, 0);
  at.setMinutes(0);
  at.setHours(preferredHour);
  if (at.getTime() <= from.getTime() + 60_000) {
    at.setDate(at.getDate() + 1);
  }
  return at;
}

export async function syncNotifications(opts?: {
  /** When true, also fire a dense near-term burst so you can verify OS delivery. */
  burst?: boolean;
}): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const setup = await loadSetupSession();
    const locale = setup.language || 'en';
    const ledger = await loadLedger().catch(() => null);
    const spaceId =
      ledger?.activeSpaceId ?? ledger?.spaces[0]?.id ?? 'space_personal';
    const memberSpaceIds = (ledger?.spaces ?? []).map((s) => s.id);
    if (!memberSpaceIds.includes(spaceId)) memberSpaceIds.push(spaceId);

    const engagement = buildEngagementFacts({
      goals: ledger?.goals,
      recurring: ledger?.recurring,
    });

    const preferences: NotificationPreference = {
      userId: ledger?.userId ?? 'guest',
      enabled: setup.notificationsEnabled,
      // QA: allow every category so a rebuild can schedule a full set.
      categories: ALL_NOTIFICATION_CATEGORIES,
      quietHoursStart: 22,
      quietHoursEnd: 7,
      preferredHour: 9,
      maxDaily: ALL_NOTIFICATION_CATEGORIES.length,
      maxWeeklyReviews: 1,
      previewMode: 'summary',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    };

    const snapshot: NotificationSnapshot = {
      spaceId,
      periodLabel: periodLabel(),
      facts: {
        summary: t(locale, 'notifications.body.generic'),
        spent: ledger?.transactions.length ?? 0,
        goalTight: engagement.goalTight ?? 0,
        goalPace: engagement.goalPace ?? '',
        ...engagement,
      },
      sourceTimestamp: new Date().toISOString(),
      dataFreshness: 'fresh',
      locale,
      currency: ledger?.spaces.find((s) => s.id === spaceId)?.currency ?? setup.currency,
      // Unlock sample-gated categories for local testing.
      sampleSize: Math.max(ledger?.transactions.length ?? 0, 8),
      memberSpaceIds,
    };

    if (!setup.notificationsEnabled) {
      const scheduler = await createExpoNotificationScheduler(locale);
      await rebuildNotificationSchedule(scheduler, { preferences, snapshot });
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return;

    const scheduler = await createExpoNotificationScheduler(locale);
    const preferred = nextPreferredAt(preferences.preferredHour);
    const diff = await rebuildNotificationSchedule(scheduler, {
      preferences,
      snapshot,
      // Force planner past quiet-hours gate during daytime testing; quiet hours
      // still cancel when disabled via preferences.enabled = false.
      localHour: 12,
    });

    // Re-stamp schedule times onto preferred hour (+ small stagger) so DATE
    // triggers are not already in the past.
    if (diff.schedule.length) {
      await scheduler.cancel(diff.schedule.map((s) => s.fingerprint));
      const stamped = diff.schedule.map((item, i) => ({
        ...item,
        titleKey: TITLE_KEYS[item.type] ?? item.titleKey,
        bodyPayload: {
          ...item.bodyPayload,
          summary: t(locale, BODY_KEYS[item.type] ?? 'notifications.body.generic'),
        },
        scheduledAt: new Date(preferred.getTime() + i * 60_000).toISOString(),
      }));
      await scheduler.schedule(stamped);
    }

    if (opts?.burst) {
      await scheduleNotificationBurst(locale);
    }
  } catch (err) {
    console.warn('[notifications] sync failed', err);
  } finally {
    syncing = false;
  }
}

/** Start listening for foreground → rebuild schedule. */
export function startNotificationLifecycle(): () => void {
  void syncNotifications({ burst: false });

  const onChange = (next: AppStateStatus) => {
    if (next === 'active') void syncNotifications({ burst: false });
  };
  appStateSub?.remove();
  appStateSub = AppState.addEventListener('change', onChange);
  return () => {
    appStateSub?.remove();
    appStateSub = null;
  };
}

export async function enableNotificationsAndBurst(): Promise<boolean> {
  await loadSetupSession(); // ensure storage ready
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  await syncNotifications({ burst: true });
  return true;
}
