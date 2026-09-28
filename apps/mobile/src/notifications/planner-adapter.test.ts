import { describe, expect, it } from 'vitest';
import type { NotificationPreference, NotificationSnapshot } from '@clear-money/domain';
import { createMemoryScheduler, rebuildNotificationSchedule } from './planner-adapter';

const prefs: NotificationPreference = {
  userId: 'user_1',
  enabled: true,
  categories: ['daily_mini_report', 'weekly_review'],
  quietHoursStart: 22,
  quietHoursEnd: 7,
  preferredHour: 9,
  maxDaily: 1,
  maxWeeklyReviews: 1,
  previewMode: 'generic',
  timezone: 'UTC',
};

const snapshot: NotificationSnapshot = {
  spaceId: 'space_1',
  periodLabel: '2026-09-24',
  facts: { summary: 'ok' },
  sourceTimestamp: '2026-09-24T10:00:00Z',
  dataFreshness: 'fresh',
  locale: 'en',
  currency: 'USD',
  sampleSize: 10,
  memberSpaceIds: ['space_1'],
};

describe('rebuildNotificationSchedule', () => {
  it('replaces rather than appends duplicates', async () => {
    const scheduler = createMemoryScheduler();
    const first = await rebuildNotificationSchedule(scheduler, {
      preferences: prefs,
      snapshot,
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(first.schedule.length).toBeGreaterThan(0);
    const countAfterFirst = scheduler.scheduled.size;

    const second = await rebuildNotificationSchedule(scheduler, {
      preferences: prefs,
      snapshot,
      nowIso: '2026-09-24T10:05:00Z',
      localHour: 10,
    });
    expect(second.cancelFingerprints.length).toBe(0);
    expect(scheduler.scheduled.size).toBe(countAfterFirst);
  });

  it('cancels everything when notifications disabled', async () => {
    const scheduler = createMemoryScheduler();
    await rebuildNotificationSchedule(scheduler, {
      preferences: prefs,
      snapshot,
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(scheduler.scheduled.size).toBeGreaterThan(0);

    await rebuildNotificationSchedule(scheduler, {
      preferences: { ...prefs, enabled: false },
      snapshot,
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(scheduler.scheduled.size).toBe(0);
  });
});
