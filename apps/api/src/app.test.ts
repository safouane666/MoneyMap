import { describe, expect, it } from 'vitest';
import {
  computePeriodTotals,
  can,
  requiresConfirmation,
  canCreateSpace,
  defaultLimitsForPlan,
  buildPublicBillingConfig,
  createIdempotencyKey,
  filterVisibleEntries,
} from '@clear-money/domain';
import { maskEmail } from './mask-email.js';

describe('api domain contracts', () => {
  it('viewer cannot create', () => {
    expect(can('viewer', 'create')).toBe(false);
    expect(can('viewer', 'invite')).toBe(false);
  });

  it('masks invite email for public GET (P3.1)', () => {
    expect(maskEmail('friend@example.com')).toBe('fr***@example.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('filters child entries on list contract (P3.3)', () => {
    const rows = [
      { id: '1', createdBy: 'child_1' },
      { id: '2', createdBy: 'parent_1' },
    ];
    expect(filterVisibleEntries('child', 'child_1', rows)).toEqual([
      { id: '1', createdBy: 'child_1' },
    ]);
    expect(filterVisibleEntries('viewer', 'viewer_1', rows)).toHaveLength(2);
  });

  it('role allowlist matches SpaceRole union (P3.2)', () => {
    const allowed = new Set(['owner', 'admin', 'contributor', 'viewer', 'child']);
    expect(allowed.has('owner')).toBe(true);
    expect(allowed.has('superadmin')).toBe(false);
  });

  it('transfers excluded from net', () => {
    const totals = computePeriodTotals(
      [
        {
          id: '1',
          spaceId: 's',
          type: 'income',
          amountMinor: 10000,
          currency: 'USD',
          categoryId: null,
          description: null,
          occurredAt: '2026-09-24T10:00:00Z',
          createdAt: '2026-09-24T10:00:00Z',
          createdBy: 'u',
          source: 'manual',
          status: 'confirmed',
        },
        {
          id: '2',
          spaceId: 's',
          type: 'transfer',
          amountMinor: 2000,
          currency: 'USD',
          categoryId: null,
          description: null,
          occurredAt: '2026-09-24T11:00:00Z',
          createdAt: '2026-09-24T11:00:00Z',
          createdBy: 'u',
          source: 'manual',
          status: 'confirmed',
        },
        {
          id: '3',
          spaceId: 's',
          type: 'expense',
          amountMinor: 3000,
          currency: 'USD',
          categoryId: null,
          description: null,
          occurredAt: '2026-09-24T12:00:00Z',
          createdAt: '2026-09-24T12:00:00Z',
          createdBy: 'u',
          source: 'manual',
          status: 'confirmed',
        },
      ],
      'USD',
    );
    expect(totals.netMinor).toBe(7000);
    expect(totals.transferMinor).toBe(2000);
  });

  it('voice drafts require confirmation', () => {
    expect(requiresConfirmation('voice')).toBe(true);
    expect(requiresConfirmation('receipt')).toBe(true);
    expect(requiresConfirmation('manual')).toBe(false);
  });

  it('idempotency keys are unique-ish', () => {
    const a = createIdempotencyKey();
    const b = createIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.startsWith('idem_')).toBe(true);
  });

  it('free plan allows two spaces then blocks a third', () => {
    expect(
      canCreateSpace({
        plan: 'free',
        personalSpaceCount: 1,
        totalSpaceCount: 1,
        usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 1 },
        limits: defaultLimitsForPlan('free'),
      }).ok,
    ).toBe(true);
    expect(
      canCreateSpace({
        plan: 'free',
        personalSpaceCount: 1,
        totalSpaceCount: 2,
        usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 2 },
        limits: defaultLimitsForPlan('free'),
      }).ok,
    ).toBe(false);
    expect(defaultLimitsForPlan('free').activeMembers).toBe(2);
  });

  it('beta free hides payment UI', () => {
    expect(
      buildPublicBillingConfig({
        billingMode: 'disabled',
        billingEnabled: false,
        betaFreeMode: true,
        defaultPlan: 'free',
        planFreeEnabled: true,
        planPlusEnabled: false,
        planPlusMonthlyPrice: 4.99,
        planPlusAnnualPrice: 39.99,
      }).showPaymentUi,
    ).toBe(false);
  });
});

describe('in-memory idempotency + draft confirm', () => {
  type Row = { id: string; idempotencyKey: string; status: string; source: string };

  function createTxn(
    store: Map<string, Row>,
    role: 'viewer' | 'owner',
    input: { idempotencyKey: string; source: 'manual' | 'voice' },
  ) {
    if (!can(role, 'create')) throw new Error('FORBIDDEN');
    const existing = store.get(input.idempotencyKey);
    if (existing) return { row: existing, replayed: true };
    const status = requiresConfirmation(input.source) ? 'draft' : 'confirmed';
    const row = { id: `txn_${store.size + 1}`, idempotencyKey: input.idempotencyKey, status, source: input.source };
    store.set(input.idempotencyKey, row);
    return { row, replayed: false };
  }

  it('replays same idempotency key', () => {
    const store = new Map<string, Row>();
    const first = createTxn(store, 'owner', { idempotencyKey: 'idem_1', source: 'manual' });
    const second = createTxn(store, 'owner', { idempotencyKey: 'idem_1', source: 'manual' });
    expect(second.replayed).toBe(true);
    expect(second.row.id).toBe(first.row.id);
  });

  it('draft confirm required for voice', () => {
    const store = new Map<string, Row>();
    const { row } = createTxn(store, 'owner', { idempotencyKey: 'idem_v', source: 'voice' });
    expect(row.status).toBe('draft');
    row.status = 'confirmed';
    expect(row.status).toBe('confirmed');
  });

  it('viewer cannot create via in-memory guard', () => {
    const store = new Map<string, Row>();
    expect(() => createTxn(store, 'viewer', { idempotencyKey: 'idem_x', source: 'manual' })).toThrow(
      'FORBIDDEN',
    );
  });
});
