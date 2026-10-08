/**
 * Device-local notification sync for Penny.
 * Rebuilds on app open / enable / settings — calm cadence only.
 */
import {
  DEFAULT_NOTIFICATION_CATEGORIES,
  buildEngagementFacts,
  stampNotificationTimes,
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
  ...DEFAULT_NOTIFICATION_CATEGORIES,
];

const TITLE_KEYS: Record<NotificationCategory, string> = {
  daily_log_reminder: 'notifications.dailyLogReminder',
  weekly_review: 'notifications.weeklyReview',
  month_end_report: 'notifications.monthEndReport',
  subscription_due: 'notifications.subscriptionDue',
  salary_due: 'notifications.salaryDue',
  savings_goal: 'notifications.savingsGoal',
  daily_spend_fact: 'notifications.dailySpendFact',
  daily_mini_report: 'notifications.dailyMiniReport',
  time_pattern: 'notifications.timePattern',
  category_change: 'notifications.categoryChange',
  safe_to_spend: 'notifications.safeToSpend',
  gentle_inactivity: 'notifications.dailyLogReminder',
};

const BODY_KEYS: Record<NotificationCategory, string> = {
  daily_log_reminder: 'notifications.body.dailyLogReminder',
  weekly_review: 'notifications.body.weeklyReview',
  month_end_report: 'notifications.body.monthEndReport',
  subscription_due: 'notifications.body.subscriptionDue',
  salary_due: 'notifications.body.salaryDue',
  savings_goal: 'notifications.body.savingsGoal',
  daily_spend_fact: 'notifications.body.dailySpendFact',
  daily_mini_report: 'notifications.body.dailyMiniReport',
  time_pattern: 'notifications.body.timePattern',
  category_change: 'notifications.body.categoryChange',
  safe_to_spend: 'notifications.body.safeToSpend',
  gentle_inactivity: 'notifications.body.dailyLogReminder',
};

let syncing = false;
let appStateSub: { remove: () => void } | null = null;

function periodLabel(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function syncNotifications(opts?: {
  /** When true, also fire a short near-term burst so you can verify OS delivery. */
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
      categories: DEFAULT_NOTIFICATION_CATEGORIES,
      quietHoursStart: 22,
      quietHoursEnd: 7,
      preferredHour: 19, // 7pm local
      maxDaily: 1,
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
      sampleSize: ledger?.transactions.length ?? 0,
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
    const now = new Date();
    const diff = await rebuildNotificationSchedule(scheduler, {
      preferences,
      snapshot,
      // Prefer daytime check so quiet hours don't wipe the whole rebuild;
      // fire times are stamped to 7pm / Sunday / month-end below.
      localHour: Math.min(20, Math.max(8, now.getHours())),
    });

    if (diff.schedule.length) {
      await scheduler.cancel(diff.schedule.map((s) => s.fingerprint));
      const stamped = stampNotificationTimes(diff.schedule, preferences.preferredHour, now).map(
        (item) => ({
          ...item,
          titleKey: TITLE_KEYS[item.type] ?? item.titleKey,
          bodyPayload: {
            ...item.bodyPayload,
            summary: t(locale, BODY_KEYS[item.type] ?? 'notifications.body.generic'),
          },
        }),
      );
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
  await loadSetupSession();
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  await syncNotifications({ burst: true });
  return true;
}
