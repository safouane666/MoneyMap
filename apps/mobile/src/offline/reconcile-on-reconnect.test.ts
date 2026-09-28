import { describe, expect, it, vi } from 'vitest';
import {
  createReconcileGate,
  isNetInfoOnline,
  shouldReconcileOnAppStateChange,
  shouldReconcileOnNetworkChange,
} from './reconnect-policy';
import { OfflineQueue, type OfflineStore, type OfflineTransaction, type SyncApi } from './queue';

function memoryStore(): OfflineStore {
  const map = new Map<string, OfflineTransaction>();
  return {
    async list() {
      return [...map.values()];
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async getByIdempotencyKey(key) {
      return [...map.values()].find((t) => t.idempotencyKey === key) ?? null;
    },
    async upsert(txn) {
      map.set(txn.id, txn);
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

describe('reconnect-policy helpers', () => {
  it('triggers only on offline → online transition', () => {
    expect(shouldReconcileOnNetworkChange(null, true)).toBe(false);
    expect(shouldReconcileOnNetworkChange(true, true)).toBe(false);
    expect(shouldReconcileOnNetworkChange(false, false)).toBe(false);
    expect(shouldReconcileOnNetworkChange(false, true)).toBe(true);
  });

  it('triggers when app returns to active while online', () => {
    expect(shouldReconcileOnAppStateChange('background', 'active', true)).toBe(true);
    expect(shouldReconcileOnAppStateChange('inactive', 'active', true)).toBe(true);
    expect(shouldReconcileOnAppStateChange('active', 'active', true)).toBe(false);
    expect(shouldReconcileOnAppStateChange('background', 'active', false)).toBe(false);
  });

  it('treats connected + reachable-null as online', () => {
    expect(isNetInfoOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isNetInfoOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isNetInfoOnline({ isConnected: false, isInternetReachable: true })).toBe(false);
  });

  it('serializes concurrent reconcile runs', async () => {
    let calls = 0;
    let resolveFirst!: () => void;
    const first = new Promise<void>((r) => {
      resolveFirst = r;
    });
    const gate = createReconcileGate({
      async reconcile() {
        calls += 1;
        if (calls === 1) await first;
        return { synced: 1, conflicts: 0 };
      },
    });

    const a = gate.run();
    const b = gate.run();
    expect(calls).toBe(1);
    resolveFirst();
    await Promise.all([a, b]);
    expect(calls).toBe(1);

    await gate.run();
    expect(calls).toBe(2);
  });
});

describe('OfflineQueue reconnect idempotency', () => {
  it('second reconcile does not re-POST confirmed items', async () => {
    const store = memoryStore();
    const upsert = vi.fn(async (txn: OfflineTransaction) => ({
      ok: true as const,
      remote: {
        id: txn.id,
        idempotencyKey: txn.idempotencyKey,
        amountMinor: txn.amountMinor,
        updatedAt: txn.updatedAt,
        description: txn.description,
        categoryId: txn.categoryId,
        status: 'confirmed',
      },
    }));
    const api: SyncApi = { upsertTransaction: upsert };
    const queue = new OfflineQueue(store, api);

    await queue.enqueueLocal({
      spaceId: 'space_1',
      type: 'expense',
      amountMinor: 900,
      currency: 'USD',
      idempotencyKey: 'idem_reconnect',
    });

    const first = await queue.reconcile();
    const second = await queue.reconcile();

    expect(first.synced).toBe(1);
    expect(second.synced).toBe(0);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect((await store.list()).length).toBe(1);
    expect((await store.list())[0]?.status).toBe('confirmed');
  });
});
