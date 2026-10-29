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

  it('builds a human report card without transaction ids', async () => {
    const actions: AiAction[] = [];
    const out = await runAiTool('get_report', { period: 'thisMonth' }, reportContext(), actions);
    expect(out.ok).toBe(true);
    const report = actions.find((a) => a.type === 'report');
    expect(report && report.type === 'report' ? report.title : null).toBe('This month');
    const body = report && report.type === 'report' ? report.body : '';
    expect(body).not.toMatch(/txn_/i);
    expect(body).toMatch(/Biggest spend:/);
    expect(body).toMatch(/Latest:/);
    if (out.ok) {
      expect(String(out.result.summary)).not.toMatch(/txn_/i);
    }
  });
});

describe('buildSystemPrompt', () => {
  it('pins locale, currency, report tool use, and delete guardrails', () => {
    const prompt = buildSystemPrompt(reportContext());
    expect(prompt).toContain('Reply entirely in French');
    expect(prompt).toContain('TND');
    expect(prompt).toContain('get_report');
    expect(prompt).toContain('analyze_category');
    expect(prompt).toMatch(/Never bulk-delete/);
    expect(prompt).toMatch(/Never use markdown/);
    expect(prompt).toMatch(/txn_/);
  });
});

function sponsoreContext(): AiLedgerContext {
  const now = new Date();
  const day = (d: number) =>
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), d, 12, 0, 0)).toISOString();
  return {
    currency: 'TND',
    spaceName: 'Personal',
    spaceId: 'sp1',
    locale: 'en',
    timeZone: 'UTC',
    categories: [
      { id: 'exp_sp', name: 'Sponsore', type: 'expense' },
      { id: 'inc_sp', name: 'Sponsore', type: 'income' },
      { id: 'food', name: 'Food & Drinks', type: 'expense' },
    ],
    totals: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
    // Only the latest two in "recent" — the bug the user hit.
    recent: [
      {
        id: 't_last_exp',
        type: 'expense',
        amountMinor: 830_000,
        description: 'Sponsore',
        category: 'Sponsore',
        occurredAt: day(28),
      },
      {
        id: 't_last_inc',
        type: 'income',
        amountMinor: 300_000,
        description: 'khaled',
        category: 'Sponsore',
        occurredAt: day(27),
      },
    ],
    txns: [
      { id: 't1', type: 'expense', amountMinor: 830_000, categoryId: 'exp_sp', category: 'Sponsore', description: 'Sponsore', occurredAt: day(28) },
      { id: 't2', type: 'income', amountMinor: 300_000, categoryId: 'inc_sp', category: 'Sponsore', description: 'khaled', occurredAt: day(27) },
      { id: 't3', type: 'income', amountMinor: 240_000, categoryId: 'inc_sp', category: 'Sponsore', description: 'Montasar', occurredAt: day(23) },
      { id: 't4', type: 'income', amountMinor: 58_000, categoryId: 'inc_sp', category: 'Sponsore', description: 'Montasar', occurredAt: day(19) },
      { id: 't5', type: 'expense', amountMinor: 400_000, categoryId: 'exp_sp', category: 'Sponsore', description: 'Sponsore', occurredAt: day(11) },
      { id: 't6', type: 'income', amountMinor: 180_000, categoryId: 'inc_sp', category: 'Sponsore', description: 'Montasar', occurredAt: day(3) },
      { id: 't7', type: 'expense', amountMinor: 2_300, categoryId: 'food', category: 'Food & Drinks', description: 'meat', occurredAt: day(20) },
    ],
  };
}

describe('analyze_category', () => {
  it('sums every Sponsore income and expense in the period, not just recent', async () => {
    const actions: AiAction[] = [];
    const out = await runAiTool(
      'analyze_category',
      { query: 'Sponsore', period: 'thisMonth' },
      sponsoreContext(),
      actions,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.entryCount).toBe(6);
    expect((out.result.income as { count: number }).count).toBe(4);
    expect((out.result.expense as { count: number }).count).toBe(2);
    // 300+240+58+180 = 778 income; 830+400 = 1230 expense → lost 452
    expect((out.result.income as { amount: number }).amount).toBe(778);
    expect((out.result.expense as { amount: number }).amount).toBe(1230);
    expect((out.result.net as { meaning: string }).meaning).toBe('lost');
    expect(actions.some((a) => a.type === 'report')).toBe(true);
  });
});

describe('find_entries pool search', () => {
  it('returns totals across the full pool, not only recent', async () => {
    const out = await runAiTool(
      'find_entries',
      { query: 'Sponsore', period: 'thisMonth' },
      sponsoreContext(),
      [],
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.count).toBe(6);
    expect(out.result.incomeTotal).toBe(778);
    expect(out.result.expenseTotal).toBe(1230);
  });
});

describe('get_report income focus', () => {
  it('surfaces income categories instead of biggest spend', async () => {
    const actions: AiAction[] = [];
    const out = await runAiTool(
      'get_report',
      { focus: 'income report please', period: 'thisMonth', chart: 'category' },
      reportContext(),
      actions,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.topIncome).toEqual(
      expect.objectContaining({ name: 'Salary' }),
    );
    expect(String(out.result.insightHint)).toMatch(/income/i);
    const report = actions.find((a) => a.type === 'report');
    expect(report && report.type === 'report' ? report.title : '').toMatch(/income/i);
    expect(report && report.type === 'report' ? report.body : '').toMatch(/Top income source/i);
  });
});
