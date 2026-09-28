import { describe, expect, it } from 'vitest';
import { computePeriodTotals, type LedgerTransaction } from '@clear-money/domain';
import { emptyState, getSpaceTotals, type DemoState } from './demo-state';

function txn(
  partial: Partial<LedgerTransaction> & Pick<LedgerTransaction, 'id' | 'type' | 'amountMinor'>,
): LedgerTransaction {
  return {
    spaceId: 'space_personal',
    currency: 'USD',
    categoryId: null,
    description: null,
    occurredAt: '2026-09-24T12:00:00.000Z',
    createdAt: '2026-09-24T12:00:00.000Z',
    createdBy: 'user_1',
    source: 'manual',
    status: 'confirmed',
    ...partial,
  };
}

describe('getSpaceTotals parity with domain', () => {
  it('matches computePeriodTotals for the same fixture', () => {
    const transactions = [
      txn({ id: 'txn_1', type: 'income', amountMinor: 10000 }),
      txn({ id: 'txn_2', type: 'expense', amountMinor: 3000 }),
      txn({ id: 'txn_3', type: 'transfer', amountMinor: 2000 }),
    ];
    const state: DemoState = {
      ...emptyState(),
      activeSpaceId: 'space_personal',
      spaces: [
        {
          id: 'space_personal',
          name: 'Personal',
          currency: 'USD',
          role: 'owner',
        },
      ],
      transactions,
    };

    const fromLedger = getSpaceTotals(state, 'space_personal');
    const fromDomain = computePeriodTotals(transactions, 'USD');
    expect(fromLedger).toEqual(fromDomain);
    expect(fromLedger.netMinor).toBe(7000);
  });
});
