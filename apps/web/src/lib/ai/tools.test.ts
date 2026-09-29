import { describe, expect, it } from 'vitest';
import { computeGoalPlan } from './tools';

describe('computeGoalPlan', () => {
  it('splits target across duration with monthly ceil', () => {
    const plan = computeGoalPlan({
      targetMajor: 2000,
      durationMonths: 3,
      currency: 'USD',
      startDate: '2026-01-15',
      name: 'Gaming PC',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.name).toBe('Gaming PC');
    expect(plan.targetMinor).toBe(200_000);
    expect(plan.monthlyMinor).toBe(66_667);
    expect(plan.endDate).toBe('2026-04-15');
  });

  it('rejects non-positive targets', () => {
    expect(computeGoalPlan({ targetMajor: 0, durationMonths: 3, currency: 'USD' }).ok).toBe(
      false,
    );
  });
});
