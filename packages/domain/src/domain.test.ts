import { describe, expect, it } from 'vitest';
import {
  money,
  addMoney,
  parseDisplayAmount,
  formatMinorUnits,
  currencyDecimalPlaces,
  computePeriodTotals,
  busiestSpendingHour,
  highestSpendingWeekday,
  lateEntryInsight,
  computeSafeToSpend,
  can,
  filterVisibleEntries,
  planHasFeature,
  canCreateSpace,
  canUseFeature,
  buildPublicBillingConfig,
  defaultLimitsForPlan,
  planNotifications,
  formatNotificationPreview,
  directionForLocale,
  requiresConfirmation,
  type LedgerTransaction,
  type EntitlementContext,
} from './index.js';

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
  it('free plan allows personal + shared space, blocks a third', () => {
    const oneSpace: EntitlementContext = {
      plan: 'free',
      personalSpaceCount: 1,
      totalSpaceCount: 1,
      usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 1 },
      limits: defaultLimitsForPlan('free'),
    };
    expect(canCreateSpace(oneSpace).ok).toBe(true);

    const twoSpaces: EntitlementContext = {
      ...oneSpace,
      personalSpaceCount: 1,
      totalSpaceCount: 2,
    };
    expect(canCreateSpace(twoSpaces).ok).toBe(false);
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
      'daily_mini_report',
      'daily_spend_fact',
      'weekly_review',
    ] as const,
    quietHoursStart: 22,
    quietHoursEnd: 7,
    preferredHour: 9,
    maxDaily: 1,
    maxWeeklyReviews: 1,
    previewMode: 'generic' as const,
    timezone: 'UTC',
  };

  const snapshot = {
    spaceId: 'space_1',
    periodLabel: '2026-W39',
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

  it('caps daily engagement and rebuilds fingerprints', () => {
    const diff = planNotifications({
      preferences: { ...basePrefs, categories: [...basePrefs.categories] },
      snapshot,
      existingFingerprints: ['old:fp'],
      nowIso: '2026-09-24T10:00:00Z',
      localHour: 10,
    });
    expect(diff.schedule.filter((s) => s.type !== 'weekly_review')).toHaveLength(1);
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

  it('formats privacy previews', () => {
    expect(formatNotificationPreview('generic', 'Spent 42', 'Summary')).toBe(
      'Your Clear Money update is ready.',
    );
  });
});

describe('locale', () => {
  it('detects RTL for Arabic', () => {
    expect(directionForLocale('ar')).toBe('rtl');
    expect(directionForLocale('fr-TN')).toBe('ltr');
  });
});
