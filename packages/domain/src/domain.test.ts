import { describe, expect, it } from 'vitest';
import {
  money,
  addMoney,
  parseDisplayAmount,
  parseAmountInput,
  evaluateAmountExpression,
  formatMinorUnits,
  currencyDecimalPlaces,
  computePeriodTotals,
  busiestSpendingHour,
  highestSpendingWeekday,
  lateEntryInsight,
  categoryChipParts,
  computeSafeToSpend,
  monthlyTargetMinor,
  expectedSavedByDate,
  evaluateGoalPace,
  addMonthsToIsoDate,
  can,
  filterVisibleEntries,
  planHasFeature,
  canCreateSpace,
  canUseFeature,
  buildPublicBillingConfig,
  defaultLimitsForPlan,
  planNotifications,
  formatNotificationPreview,
  buildEngagementFacts,
  directionForLocale,
  requiresConfirmation,
  clampDayOfMonth,
  computeNextDueAt,
  advanceNextDueAt,
  wasPostedThisCalendarMonth,
  recurringIdempotencyKey,
  type Goal,
  type LedgerTransaction,
  type EntitlementContext,
} from './index.js';

function goal(partial: Partial<Goal> = {}): Goal {
  return {
    id: 'goal_1',
    spaceId: 'space_1',
    name: 'Gaming PC',
    targetMinor: 200_000,
    savedMinor: 0,
    currency: 'USD',
    startDate: '2026-01-15',
    durationMonths: 3,
    targetDate: '2026-04-15',
    plannedContributionMinor: 0,
    notificationPolicy: 'weekly',
    status: 'active',
    paceStatus: 'on_track',
    ...partial,
  };
}

function txn(partial: Partial<LedgerTransaction> & Pick<LedgerTransaction, 'type' | 'amountMinor'>): LedgerTransaction {
  return {
    id: 'txn_1',
    spaceId: 'space_1',
    currency: 'USD',
    categoryId: 'cat_1',
    description: null,
    occurredAt: '2026-09-24T18:00:00+01:00',
    createdAt: '2026-09-24T18:05:00+01:00',
    createdBy: 'user_1',
    source: 'manual',
    status: 'confirmed',
    ...partial,
  };
}

describe('money', () => {
  it('adds minor units without floats', () => {
    expect(addMoney(money(4500, 'USD'), money(250, 'USD'))).toEqual({
      amountMinor: 4750,
      currency: 'USD',
    });
  });

  it('supports TND three-decimal currencies', () => {
    expect(currencyDecimalPlaces('TND')).toBe(3);
    expect(parseDisplayAmount('12.500', 'TND')).toBe(12500);
    expect(formatMinorUnits(12500, 'TND', 'fr-TN')).toContain('12');
  });

  it('supports zero-decimal JPY', () => {
    expect(currencyDecimalPlaces('JPY')).toBe(0);
    expect(parseDisplayAmount('1200', 'JPY')).toBe(1200);
  });

  it('rejects excess decimals', () => {
    expect(() => parseDisplayAmount('1.234', 'USD')).toThrow();
  });

  it('evaluates quick amount expressions', () => {
    expect(evaluateAmountExpression('12+3.5')).toBe('15.5');
    expect(evaluateAmountExpression('10×2+1')).toBe('21');
    expect(evaluateAmountExpression('100÷4')).toBe('25');
    expect(parseAmountInput('12+3', 'USD')).toBe(1500);
  });
});

describe('period totals', () => {
  it('excludes transfers from net', () => {
    const totals = computePeriodTotals(
      [
        txn({ type: 'income', amountMinor: 10000 }),
        txn({ type: 'expense', amountMinor: 3000, id: 'txn_2' }),
        txn({ type: 'transfer', amountMinor: 2000, id: 'txn_3' }),
      ],
      'USD',
    );
    expect(totals).toEqual({
      incomeMinor: 10000,
      expenseMinor: 3000,
      transferMinor: 2000,
      netMinor: 7000,
      currency: 'USD',
    });
  });

  it('ignores drafts', () => {
    const totals = computePeriodTotals(
      [txn({ type: 'expense', amountMinor: 500, status: 'draft' })],
      'USD',
    );
    expect(totals.netMinor).toBe(0);
  });
});

describe('time insights', () => {
  it('requires minimum sample', () => {
    const insight = busiestSpendingHour(
      [txn({ type: 'expense', amountMinor: 100 })],
      'Africa/Tunis',
    );
    expect(insight.message).toBe('Not enough data yet');
  });

  it('finds busiest hour with enough data', () => {
    const txs = Array.from({ length: 6 }, (_, i) =>
      txn({
        id: `txn_${i}`,
        type: 'expense',
        amountMinor: 1000,
        occurredAt: '2026-09-24T19:30:00+01:00',
      }),
    );
    const insight = busiestSpendingHour(txs, 'Africa/Tunis');
    expect(insight.kind).toBe('busiest_hour');
    expect(insight.message).toContain('19:00');
  });

  it('detects late entries using occurredAt vs createdAt', () => {
    const insight = lateEntryInsight([
      txn({
        type: 'expense',
        amountMinor: 100,
        occurredAt: '2026-09-20T10:00:00Z',
        createdAt: '2026-09-24T10:00:00Z',
      }),
    ]);
    expect(insight.data?.lateCount).toBe(1);
  });

  it('finds highest weekday', () => {
    const txs = Array.from({ length: 6 }, (_, i) =>
      txn({
        id: `txn_${i}`,
        type: 'expense',
        amountMinor: 500,
        // 2026-09-26 is Saturday
        occurredAt: '2026-09-26T12:00:00+01:00',
      }),
    );
    expect(highestSpendingWeekday(txs, 'Africa/Tunis').message).toContain('Saturday');
  });
});

describe('category chips', () => {
  it('splits category chips into emoji + label', () => {
    expect(categoryChipParts('Food', 'food_drinks')).toEqual({
      emoji: '🍔',
      label: 'Food & Drinks',
    });
    expect(categoryChipParts('Custom Trip').label).toBe('Custom Trip');
  });
});

describe('goals / safe-to-spend', () => {
  it('computes baseline estimate', () => {
    const result = computeSafeToSpend({
      incomeMinor: 100000,
      expenseMinor: 40000,
      plannedContributionMinor: 10000,
      scheduledExpenseMinor: 5000,
      bufferMinor: 5000,
      currency: 'USD',
      hasRequiredInputs: true,
    });
    expect(result.status).toBe('ok');
    expect(result.estimateMinor).toBe(40000);
    expect(result.breakdown.length).toBe(5);
  });

  it('floors safe-to-spend at zero when overspent', () => {
    const result = computeSafeToSpend({
      incomeMinor: 10000,
      expenseMinor: 50000,
      plannedContributionMinor: 20000,
      scheduledExpenseMinor: 0,
      bufferMinor: 0,
      currency: 'USD',
      hasRequiredInputs: true,
    });
    expect(result.status).toBe('ok');
    expect(result.estimateMinor).toBe(0);
  });

  it('returns honest empty when inputs missing', () => {
    const result = computeSafeToSpend({
      incomeMinor: 0,
      expenseMinor: 0,
      plannedContributionMinor: 0,
      scheduledExpenseMinor: 0,
      bufferMinor: 0,
      currency: 'USD',
      hasRequiredInputs: false,
    });
    expect(result.message).toBe('Not enough data to estimate');
    expect(result.estimateMinor).toBeNull();
  });

  it('splits target into monthly ceil unless planned contribution is set', () => {
    expect(monthlyTargetMinor(goal({ targetMinor: 200_000, durationMonths: 3 }))).toBe(
      Math.ceil(200_000 / 3),
    );
    expect(
      monthlyTargetMinor(goal({ targetMinor: 200_000, durationMonths: 3, plannedContributionMinor: 50_000 })),
    ).toBe(50_000);
  });

  it('adds months to ISO dates and clamps day overflow', () => {
    expect(addMonthsToIsoDate('2026-01-15', 3)).toBe('2026-04-15');
    expect(addMonthsToIsoDate('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('expects cumulative savings by months elapsed', () => {
    const g = goal({ targetMinor: 300_000, durationMonths: 3, plannedContributionMinor: 0 });
    const monthly = Math.ceil(300_000 / 3);
    expect(expectedSavedByDate(g, '2026-01-15')).toBe(0);
    expect(expectedSavedByDate(g, '2026-02-15')).toBe(monthly);
    expect(expectedSavedByDate(g, '2026-03-15')).toBe(monthly * 2);
    expect(expectedSavedByDate(g, '2026-04-15')).toBe(Math.min(300_000, monthly * 3));
  });

  it('classifies pace ahead / on_track / tight / behind', () => {
    const monthly = Math.ceil(300_000 / 3);
    const base = goal({ targetMinor: 300_000, durationMonths: 3, plannedContributionMinor: 0 });
    // After 1 month, expected = monthly
    expect(evaluateGoalPace({ ...base, savedMinor: Math.floor(monthly * 1.06) }, '2026-02-15').paceStatus).toBe(
      'ahead',
    );
    expect(evaluateGoalPace({ ...base, savedMinor: monthly }, '2026-02-15').paceStatus).toBe('on_track');
    expect(
      evaluateGoalPace({ ...base, savedMinor: Math.ceil(monthly * 0.85) }, '2026-02-15').paceStatus,
    ).toBe('tight');
    expect(evaluateGoalPace({ ...base, savedMinor: Math.floor(monthly * 0.84) }, '2026-02-15').paceStatus).toBe(
      'behind',
    );
  });

  it('marks won when target met and lost after end if short', () => {
    const g = goal({ targetMinor: 100_000, durationMonths: 2, targetDate: '2026-03-15' });
    expect(evaluateGoalPace({ ...g, savedMinor: 100_000 }, '2026-02-01').paceStatus).toBe('won');
    expect(evaluateGoalPace({ ...g, savedMinor: 50_000 }, '2026-03-15').paceStatus).toBe('lost');
    expect(evaluateGoalPace({ ...g, savedMinor: 50_000 }, '2026-03-16').paceStatus).toBe('lost');
  });
});

describe('recurring', () => {
  it('clamps day of month to 1..28', () => {
    expect(clampDayOfMonth(0)).toBe(1);
    expect(clampDayOfMonth(31)).toBe(28);
    expect(clampDayOfMonth(15.9)).toBe(15);
  });

  it('computes next due at today or future day this month', () => {
    const from = new Date(Date.UTC(2026, 8, 10, 8, 0, 0)); // Sep 10
    const due = computeNextDueAt(15, from);
    expect(due.toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });

  it('rolls next due to next month when day already passed', () => {
    const from = new Date(Date.UTC(2026, 8, 20, 8, 0, 0)); // Sep 20
    const due = computeNextDueAt(15, from);
    expect(due.toISOString()).toBe('2026-10-15T12:00:00.000Z');
  });

  it('advances due by one month', () => {
    const due = new Date('2026-09-15T12:00:00.000Z');
    expect(advanceNextDueAt(due, 15).toISOString()).toBe('2026-10-15T12:00:00.000Z');
  });

  it('detects same calendar month posts', () => {
    const now = new Date('2026-09-28T10:00:00.000Z');
    expect(wasPostedThisCalendarMonth(new Date('2026-09-01T00:00:00.000Z'), now)).toBe(true);
    expect(wasPostedThisCalendarMonth(new Date('2026-08-31T23:00:00.000Z'), now)).toBe(false);
    expect(wasPostedThisCalendarMonth(null, now)).toBe(false);
  });

  it('builds recurring idempotency keys', () => {
    expect(recurringIdempotencyKey('sched_1', new Date('2026-09-05T00:00:00.000Z'))).toBe(
      'recurring:sched_1:2026-09',
    );
  });
});

describe('permissions', () => {
  it('blocks viewer create', () => {
    expect(can('viewer', 'create')).toBe(false);
    expect(can('viewer', 'invite')).toBe(false);
    expect(can('owner', 'manage_settings')).toBe(true);
  });

  it('filters child to own entries', () => {
    const entries = [
      { createdBy: 'child_1', id: '1' },
      { createdBy: 'parent_1', id: '2' },
    ];
    expect(filterVisibleEntries('child', 'child_1', entries)).toEqual([
      { createdBy: 'child_1', id: '1' },
    ]);
  });
});

describe('entitlements', () => {
  it('free plan allows unlimited spaces', () => {
    const oneSpace: EntitlementContext = {
      plan: 'free',
      personalSpaceCount: 1,
      totalSpaceCount: 1,
      usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 1 },
      limits: defaultLimitsForPlan('free'),
    };
    expect(canCreateSpace(oneSpace).ok).toBe(true);

    const manySpaces: EntitlementContext = {
      ...oneSpace,
      personalSpaceCount: 3,
      totalSpaceCount: 8,
    };
    expect(canCreateSpace(manySpaces).ok).toBe(true);
    expect(planHasFeature('free', 'goals')).toBe(true);
    expect(planHasFeature('free', 'penny_chat')).toBe(true);
    expect(planHasFeature('free', 'shared_members')).toBe(true);
    expect(planHasFeature('free', 'pdf_export')).toBe(false);
    expect(canUseFeature(oneSpace, 'penny_chat').ok).toBe(true);
    expect(canUseFeature(oneSpace, 'ai_monthly_report').ok).toBe(false);
    expect(canUseFeature(oneSpace, 'shared_members').ok).toBe(true);
    expect(
      canUseFeature(
        { ...oneSpace, usage: { ...oneSpace.usage, activeMembers: 2 } },
        'shared_members',
      ).ok,
    ).toBe(false);
    expect(defaultLimitsForPlan('free').activeMembers).toBe(2);
    expect(defaultLimitsForPlan('free').receiptScans).toBe(3);
    expect(defaultLimitsForPlan('free').aiRequests).toBe(40);
    expect(defaultLimitsForPlan('plus').aiRequests).toBe(200);
    expect(defaultLimitsForPlan('plus').activeMembers).toBe(10);
  });

  it('hides payment UI in beta free mode and retires Shared SKU', () => {
    const cfg = buildPublicBillingConfig({
      billingMode: 'disabled',
      billingEnabled: false,
      betaFreeMode: true,
      defaultPlan: 'free',
      planFreeEnabled: true,
      planPlusEnabled: false,
      planPlusMonthlyPrice: 4.99,
      planPlusAnnualPrice: 39.99,
    });
    expect(cfg.showPaymentUi).toBe(false);
    const shared = cfg.plans.find((p) => p.id === 'shared');
    expect(shared?.available).toBe(false);
    expect(shared?.enabled).toBe(false);
    expect(cfg.plans.find((p) => p.id === 'business')?.available).toBe(false);
  });

  it('shows payment UI only in sandbox/live when enabled', () => {
    const cfg = buildPublicBillingConfig({
      billingMode: 'sandbox',
      billingEnabled: true,
      betaFreeMode: false,
      defaultPlan: 'free',
      planFreeEnabled: true,
      planPlusEnabled: true,
      planPlusMonthlyPrice: 4.99,
      planPlusAnnualPrice: 39.99,
    });
    expect(cfg.showPaymentUi).toBe(true);
    expect(cfg.plans.find((p) => p.id === 'plus')?.available).toBe(true);
    expect(cfg.plans.find((p) => p.id === 'shared')?.available).toBe(false);
  });
});

describe('AI draft rule', () => {
  it('voice and receipt require confirmation', () => {
    expect(requiresConfirmation('voice')).toBe(true);
    expect(requiresConfirmation('receipt')).toBe(true);
    expect(requiresConfirmation('manual')).toBe(false);
  });
});

describe('notification planner', () => {
  const basePrefs = {
    userId: 'user_1',
    enabled: true,
    categories: [
      'daily_log_reminder',
      'weekly_review',
      'month_end_report',
      'subscription_due',
      'salary_due',
      'savings_goal',
    ] as const,
    quietHoursStart: 22,
    quietHoursEnd: 7,
    preferredHour: 19,
    maxDaily: 1,
    maxWeeklyReviews: 1,
    previewMode: 'generic' as const,
    timezone: 'UTC',
  };

  const snapshot = {
    spaceId: 'space_1',
    periodLabel: '2026-09-24',
    facts: { spend: 4200 },
    sourceTimestamp: '2026-09-24T10:00:00Z',
    dataFreshness: 'fresh' as const,
    locale: 'en',
    currency: 'USD',
    sampleSize: 10,
    memberSpaceIds: ['space_1'],
  };

  it('respects quiet hours', () => {
    const diff = planNotifications({
      preferences: { ...basePrefs, categories: [...basePrefs.categories] },
      snapshot,
      existingFingerprints: [],
      nowIso: '2026-09-24T23:00:00Z',
      localHour: 23,
    });
    expect(diff.schedule).toHaveLength(0);
  });

  it('schedules daily + weekly cadence and rebuilds fingerprints', () => {
    const diff = planNotifications({
      preferences: { ...basePrefs, categories: [...basePrefs.categories] },
      snapshot,
      existingFingerprints: ['old:fp'],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(diff.schedule.some((s) => s.type === 'daily_log_reminder')).toBe(true);
    expect(diff.schedule.some((s) => s.type === 'weekly_review')).toBe(true);
    expect(diff.cancelFingerprints).toContain('old:fp');
  });

  it('skips spaces without membership', () => {
    const diff = planNotifications({
      preferences: { ...basePrefs, categories: [...basePrefs.categories] },
      snapshot: { ...snapshot, memberSpaceIds: [] },
      existingFingerprints: [],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(diff.schedule).toHaveLength(0);
  });

  it('schedules savings_goal only when pace is tight or behind', () => {
    const prefs = {
      ...basePrefs,
      categories: [...basePrefs.categories] as const,
    };
    const onTrack = planNotifications({
      preferences: prefs,
      snapshot: { ...snapshot, facts: { ...snapshot.facts, goalPace: 'on_track' } },
      existingFingerprints: [],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(onTrack.schedule.some((s) => s.type === 'savings_goal')).toBe(false);

    const tight = planNotifications({
      preferences: prefs,
      snapshot: { ...snapshot, facts: { ...snapshot.facts, goalPace: 'tight' } },
      existingFingerprints: [],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(tight.schedule.some((s) => s.type === 'savings_goal')).toBe(true);
  });

  it('schedules subscription_due and salary_due within notify windows', () => {
    const prefs = {
      ...basePrefs,
      categories: [...basePrefs.categories] as const,
    };
    const far = planNotifications({
      preferences: prefs,
      snapshot: {
        ...snapshot,
        facts: { ...snapshot.facts, hoursUntilSubscriptionDue: 72 },
      },
      existingFingerprints: [],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(far.schedule.some((s) => s.type === 'subscription_due')).toBe(false);

    const soon = planNotifications({
      preferences: prefs,
      snapshot: {
        ...snapshot,
        facts: {
          ...snapshot.facts,
          hoursUntilSubscriptionDue: 12,
          hoursUntilSalaryDue: 6,
          salaryDueSoon: 1,
        },
      },
      existingFingerprints: [],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(soon.schedule.some((s) => s.type === 'subscription_due')).toBe(true);
    expect(soon.schedule.some((s) => s.type === 'salary_due')).toBe(true);
  });

  it('schedules month_end_report when flagged', () => {
    const diff = planNotifications({
      preferences: { ...basePrefs, categories: [...basePrefs.categories] },
      snapshot: { ...snapshot, facts: { ...snapshot.facts, planMonthEnd: 1 } },
      existingFingerprints: [],
      nowIso: '2026-09-30T10:00:00Z',
      localHour: 10,
    });
    expect(diff.schedule.some((s) => s.type === 'month_end_report')).toBe(true);
  });

  it('formats privacy previews', () => {
    expect(formatNotificationPreview('generic', 'Spent 42', 'Summary')).toBe(
      'Your Penny update is ready.',
    );
  });

  it('builds engagement facts from goal pace and recurring due by kind', () => {
    const now = new Date('2026-09-24T10:00:00Z');
    const facts = buildEngagementFacts({
      now,
      goals: [
        { status: 'active', paceStatus: 'on_track', notificationPolicy: 'weekly' },
        { status: 'active', paceStatus: 'behind', notificationPolicy: 'on_progress' },
      ],
      recurring: [
        {
          kind: 'expense',
          active: true,
          nextDueAt: '2026-09-25T09:00:00Z',
          notifyHoursBefore: 24,
        },
        {
          kind: 'income',
          active: true,
          nextDueAt: '2026-09-24T18:00:00Z',
          notifyHoursBefore: 24,
        },
      ],
    });
    expect(facts.goalPace).toBe('behind');
    expect(facts.goalTight).toBe(1);
    expect(facts.subscriptionDueSoon).toBe(1);
    expect(facts.salaryDueSoon).toBe(1);
    expect(facts.hoursUntilSubscriptionDue).toBeGreaterThan(0);
  });
});

describe('locale', () => {
  it('detects RTL for Arabic', () => {
    expect(directionForLocale('ar')).toBe('rtl');
    expect(directionForLocale('fr-TN')).toBe('ltr');
  });
});
