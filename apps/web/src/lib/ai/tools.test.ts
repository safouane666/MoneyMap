import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, computeGoalPlan, runAiTool } from './tools';
import type { AiAction, AiLedgerContext } from './types';

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

function reportContext(): AiLedgerContext {
  const now = new Date();
  const iso = (hour: number) =>
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0)).toISOString();
  return {
    currency: 'TND',
    spaceName: 'Personal',
    spaceId: 'sp1',
    locale: 'fr',
    timeZone: 'UTC',
    categories: [
      { id: 'c1', name: 'Groceries', type: 'expense' },
      { id: 'c2', name: 'Transport', type: 'expense' },
      { id: 'c3', name: 'Salary', type: 'income' },
    ],
    totals: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
    recent: [],
    txns: [
      { type: 'expense', amountMinor: 5000, categoryId: 'c1', occurredAt: iso(12) },
      { type: 'expense', amountMinor: 2000, categoryId: 'c2', occurredAt: iso(12) },
      { type: 'expense', amountMinor: 1000, categoryId: null, occurredAt: iso(12) },
      { type: 'income', amountMinor: 30000, categoryId: 'c3', occurredAt: iso(12) },
    ],
  };
}

describe('get_report structured series', () => {
  it('returns category breakdown and queues a show_chart action', async () => {
    const actions: AiAction[] = [];
    const out = await runAiTool(
      'get_report',
      { period: 'thisMonth', chart: 'category' },
      reportContext(),
      actions,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.seriesAvailable).toBe(true);
    expect((out.result.topCategory as { name: string }).name).toBe('Groceries');
    const chart = actions.find((a) => a.type === 'show_chart');
    expect(chart && chart.type === 'show_chart' ? chart.chart : null).toBe('category');
    if (chart && chart.type === 'show_chart') {
      expect(chart.points.map((p) => p.label)).toEqual(['Groceries', 'Transport', 'Autre']);
      expect(chart.points[0]!.valueMinor).toBe(5000);
    }
    expect(actions.some((a) => a.type === 'report')).toBe(true);
  });

  it('builds hour buckets and skips the chart when chart=none', async () => {
    const actions: AiAction[] = [];
    await runAiTool('get_report', { chart: 'hours' }, reportContext(), actions);
    const hours = actions.find((a) => a.type === 'show_chart');
    expect(hours && hours.type === 'show_chart' ? hours.points : []).toEqual([
      { label: '12', valueMinor: 8000 },
    ]);

    const none: AiAction[] = [];
    await runAiTool('get_report', { chart: 'none' }, reportContext(), none);
    expect(none.some((a) => a.type === 'show_chart')).toBe(false);
  });

  it('falls back to totals only when no series is sent', async () => {
    const actions: AiAction[] = [];
    const ctx = { ...reportContext(), txns: undefined };
    const out = await runAiTool('get_report', {}, ctx, actions);
    expect(out.ok && out.result.seriesAvailable).toBe(false);
    expect(actions.some((a) => a.type === 'show_chart')).toBe(false);
  });
});

describe('buildSystemPrompt', () => {
  it('pins locale, currency, report tool use, and delete guardrails', () => {
    const prompt = buildSystemPrompt(reportContext());
    expect(prompt).toContain('Reply entirely in French');
    expect(prompt).toContain('TND');
    expect(prompt).toContain('get_report');
    expect(prompt).toMatch(/Never bulk-delete/);
  });
});
