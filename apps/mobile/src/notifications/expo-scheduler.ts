/**
 * Thin wrapper around expo-notifications.
 * Keep this module out of Vitest entrypoints — native-only.
 */
import * as Notifications from 'expo-notifications';
import type { PlannedNotification } from '@clear-money/domain';
import type { NotificationScheduler } from './planner-adapter';

/** Request OS permission only after the user taps Enable in setup. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function createExpoNotificationScheduler(): Promise<NotificationScheduler> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

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
        await Notifications.scheduleNotificationAsync({
          identifier: planned.fingerprint,
          content: {
            title: planned.titleKey,
            body: String(planned.bodyPayload.summary ?? 'Your Clear Money update is ready.'),
            data: {
              destination: planned.destination,
              spaceId: planned.spaceId,
              type: planned.type,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(planned.scheduledAt),
          },
        });
      }
    },
  };
}
