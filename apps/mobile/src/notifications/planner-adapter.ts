import {
  planNotifications,
  type NotificationPreference,
  type NotificationSnapshot,
  type PlannedNotification,
  type ScheduleDiff,
} from '@clear-money/domain';

/**
 * Device-local notification adapter for Clear Money.
 *
 * Scheduling uses expo-notifications (documented below). Engagement reminders
 * are never server cron — rebuild runs on install, permission change, app open,
 * transaction save, goal change, timezone/locale change, Space switch,
 * sign-in / sign-out, and sync.
 *
 * ## expo-notifications scheduling (best effort)
 *
 * ```ts
 * import * as Notifications from 'expo-notifications';
 *
 * Notifications.setNotificationHandler({
 *   handleNotification: async () => ({
 *     shouldShowAlert: true,
 *     shouldPlaySound: false,
 *     shouldSetBadge: false,
 *   }),
 * });
 *
 * // Cancel stale fingerprints, then schedule replacements:
 * await Notifications.cancelScheduledNotificationAsync(fingerprint);
 * await Notifications.scheduleNotificationAsync({
 *   identifier: planned.fingerprint,
 *   content: {
 *     title: t(locale, planned.titleKey),
 *     body: previewBody,
 *     data: { destination: planned.destination, spaceId: planned.spaceId },
 *   },
 *   trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(planned.scheduledAt) },
 * });
 * ```
 *
 * OS rules make exact delivery best effort. Quiet hours, caps, and dedupe are
 * enforced by domain `planNotifications` before any schedule call.
 */

export interface NotificationScheduler {
  /** Currently scheduled fingerprint identifiers on the device. */
  listFingerprints(): Promise<string[]>;
  cancel(fingerprints: string[]): Promise<void>;
  schedule(items: PlannedNotification[]): Promise<void>;
}

export interface RebuildInput {
  preferences: NotificationPreference;
  snapshot: NotificationSnapshot;
  nowIso?: string;
  localHour?: number;
}

/**
 * Rebuild the local schedule: cancel stale fingerprints, then schedule the
 * fresh plan. Replaces rather than appends duplicates.
 */
export async function rebuildNotificationSchedule(
  scheduler: NotificationScheduler,
  input: RebuildInput,
): Promise<ScheduleDiff> {
  const existingFingerprints = await scheduler.listFingerprints();
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const localHour =
    input.localHour ??
    Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: input.preferences.timezone,
      }).format(now),
    );

  const diff = planNotifications({
    preferences: input.preferences,
    snapshot: input.snapshot,
    existingFingerprints,
    nowIso: now.toISOString(),
    localHour,
  });

  if (diff.cancelFingerprints.length) {
    await scheduler.cancel(diff.cancelFingerprints);
  }
  if (diff.schedule.length) {
    await scheduler.schedule(diff.schedule);
  }

  return diff;
}

/** In-memory scheduler for unit tests and environments without OS notifications. */
export function createMemoryScheduler(): NotificationScheduler & {
  scheduled: Map<string, PlannedNotification>;
} {
  const scheduled = new Map<string, PlannedNotification>();
  return {
    scheduled,
    async listFingerprints() {
      return [...scheduled.keys()];
    },
    async cancel(fingerprints) {
      for (const fp of fingerprints) scheduled.delete(fp);
    },
    async schedule(items) {
      for (const item of items) scheduled.set(item.fingerprint, item);
    },
  };
}
