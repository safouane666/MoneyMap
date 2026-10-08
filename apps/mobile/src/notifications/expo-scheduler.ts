/**
 * Thin wrapper around expo-notifications.
 * Keep this module out of Vitest entrypoints — native-only.
 */
import * as Notifications from 'expo-notifications';
import type { PlannedNotification } from '@clear-money/domain';
import { t } from '../lib/i18n';
import type { NotificationScheduler } from './planner-adapter';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request OS permission only after the user taps Enable in setup/settings. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function resolveTitle(locale: string, titleKey: string): string {
  const translated = t(locale, titleKey);
  return translated === titleKey ? 'Penny' : translated;
}

function resolveBody(locale: string, planned: PlannedNotification): string {
  const summary = planned.bodyPayload.summary;
  if (typeof summary === 'string' && summary.trim()) return summary;
  return t(locale, 'notifications.body.generic');
}

export async function createExpoNotificationScheduler(
  locale = 'en',
): Promise<NotificationScheduler> {
  return {
    async listFingerprints() {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      return pending.map((n) => n.identifier);
    },
    async cancel(fingerprints) {
      await Promise.all(
        fingerprints.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
      );
    },
    async schedule(items: PlannedNotification[]) {
      for (const planned of items) {
        const when = new Date(planned.scheduledAt);
        const ms = when.getTime() - Date.now();
        // Prefer DATE; fall back to a short interval if the stamp is already past.
        const trigger =
          Number.isFinite(ms) && ms > 2_000
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DATE as const,
                date: when,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL as const,
                seconds: Math.max(5, Math.round((ms > 0 ? ms : 5_000) / 1000)),
              };

        await Notifications.scheduleNotificationAsync({
          identifier: planned.fingerprint,
          content: {
            title: resolveTitle(locale, planned.titleKey),
            body: resolveBody(locale, planned),
            sound: true,
            data: {
              destination: planned.destination,
              spaceId: planned.spaceId,
              type: planned.type,
            },
          },
          trigger,
        });
      }
    },
  };
}

/** Short near-term burst so a sideloaded APK can verify delivery quickly. */
export async function scheduleNotificationBurst(locale = 'en'): Promise<number> {
  const samples: { title: string; body: string; delaySec: number }[] = [
    {
      title: t(locale, 'notifications.dailyLogReminder'),
      body: t(locale, 'notifications.body.dailyLogReminder'),
      delaySec: 8,
    },
    {
      title: t(locale, 'notifications.weeklyReview'),
      body: t(locale, 'notifications.body.weeklyReview'),
      delaySec: 25,
    },
    {
      title: t(locale, 'notifications.monthEndReport'),
      body: t(locale, 'notifications.body.monthEndReport'),
      delaySec: 45,
    },
    {
      title: t(locale, 'notifications.subscriptionDue'),
      body: t(locale, 'notifications.body.subscriptionDue'),
      delaySec: 65,
    },
    {
      title: t(locale, 'notifications.salaryDue'),
      body: t(locale, 'notifications.body.salaryDue'),
      delaySec: 85,
    },
    {
      title: t(locale, 'notifications.testBurstDone'),
      body: t(locale, 'notifications.body.testBurstDone'),
      delaySec: 105,
    },
  ];

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => String(n.identifier).startsWith('test-burst:'))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;
    await Notifications.scheduleNotificationAsync({
      identifier: `test-burst:${i}:${sample.delaySec}`,
      content: {
        title: sample.title,
        body: sample.body,
        sound: true,
        data: { destination: '/(tabs)/home', testBurst: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: sample.delaySec,
      },
    });
  }
  return samples.length;
}
