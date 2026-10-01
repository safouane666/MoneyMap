import { describe, expect, it } from 'vitest';
import {
  applyDeterministicLedgerFallback,
  looksLikeLedgerIntent,
  parseMoneyUtterance,
} from './ledger-intent';
import type { AiAction, AiLedgerContext } from './types';

const baseContext = (currency = 'TND'): AiLedgerContext => ({
  currency,
  spaceName: 'Personal',
  spaceId: 'space_1',
  categories: [{ id: 'c1', name: 'Food', type: 'expense' }],
  totals: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  recent: [],
});

describe('looksLikeLedgerIntent', () => {
  it('detects spend utterances', () => {
    expect(looksLikeLedgerIntent('I spent 12.50 on coffee')).toBe(true);
    expect(looksLikeLedgerIntent('Create a coffee category')).toBe(true);
    expect(looksLikeLedgerIntent('how is the weather')).toBe(false);
  });
});

describe('parseMoneyUtterance', () => {
  it('parses 42TND in a restaurant with a note', () => {
    const parsed = parseMoneyUtterance(
      'I spent 42TND in a restaurant, note it as date with Baby',
    );
    expect(parsed).toMatchObject({
      entryType: 'expense',
      amount: 42,
      currencyCode: 'TND',
      categoryHint: 'Food & Drinks',
      note: 'date with Baby',
    });
  });
});

describe('applyDeterministicLedgerFallback', () => {
  it('asks for category chips when amount has no category', async () => {
    const actions: AiAction[] = [];
    const ok = await applyDeterministicLedgerFallback('I spent 12.50', baseContext('TND'), actions);
    expect(ok).toBe(true);
    expect(actions.some((a) => a.type === 'ask_category')).toBe(true);
    const ask = actions.find((a) => a.type === 'ask_category');
    expect(ask && ask.type === 'ask_category' && ask.amountMajor).toBe(12.5);
  });

  it('adds expense with category when merchant is clear', async () => {
    const actions: AiAction[] = [];
    const ok = await applyDeterministicLedgerFallback(
      'I spent 12.50 on coffee',
      baseContext('TND'),
      actions,
    );
    expect(ok).toBe(true);
    expect(actions.some((a) => a.type === 'add_transaction')).toBe(true);
    const txn = actions.find((a) => a.type === 'add_transaction');
    expect(txn).toMatchObject({
      type: 'add_transaction',
      category: 'Food & Drinks',
    });
    // Defaults should not invent a duplicate custom category
    expect(actions.some((a) => a.type === 'create_category')).toBe(false);
  });

  it('records restaurant spend with note in one shot', async () => {
    const actions: AiAction[] = [];
    const ok = await applyDeterministicLedgerFallback(
      'I spent 42TND in a restaurant, note it as date with Baby',
      baseContext('TND'),
      actions,
    );
    expect(ok).toBe(true);
    const txn = actions.find((a) => a.type === 'add_transaction');
    expect(txn).toMatchObject({
      type: 'add_transaction',
      entryType: 'expense',
      amountMajor: 42,
      category: 'Food & Drinks',
      note: 'date with Baby',
    });
  });

  it('still records spend when a stray report action is already present', async () => {
    const actions: AiAction[] = [{ type: 'report', title: 'Space summary', body: 'noop' }];
    const ok = await applyDeterministicLedgerFallback(
      'I spent 12.50 on coffee',
      baseContext('TND'),
      actions,
    );
    expect(ok).toBe(true);
    expect(actions.some((a) => a.type === 'add_transaction')).toBe(true);
  });

  it('does not double-add when ask_category is already queued', async () => {
    const actions: AiAction[] = [
      {
        type: 'ask_category',
        entryType: 'expense',
        amountMajor: 12.5,
        suggestions: [],
      },
    ];
    const ok = await applyDeterministicLedgerFallback('I spent 12.50 on coffee', baseContext('TND'), actions);
    expect(ok).toBe(false);
    expect(actions.filter((a) => a.type === 'add_transaction')).toHaveLength(0);
  });

  it('creates a category when asked', async () => {
    const actions: AiAction[] = [];
    const ok = await applyDeterministicLedgerFallback(
      'Create a coffee category',
      baseContext('TND'),
      actions,
    );
    expect(ok).toBe(true);
    expect(actions).toEqual([
      { type: 'create_category', name: 'Coffee', categoryType: 'expense' },
    ]);
  });

  it('create category completes an open spend draft', async () => {
    const actions: AiAction[] = [];
    const ok = await applyDeterministicLedgerFallback(
      'yeah create a Food & restaurants category',
      baseContext('TND'),
      actions,
      {
        entryType: 'expense',
        amount: 42,
        currencyCode: 'TND',
        note: 'date with Baby',
      },
    );
    expect(ok).toBe(true);
    expect(actions.some((a) => a.type === 'create_category')).toBe(true);
    expect(actions.some((a) => a.type === 'add_transaction')).toBe(true);
    const txn = actions.find((a) => a.type === 'add_transaction');
    expect(txn).toMatchObject({
      type: 'add_transaction',
      amountMajor: 42,
      category: 'Food & Drinks',
      note: 'date with Baby',
    });
  });
});
