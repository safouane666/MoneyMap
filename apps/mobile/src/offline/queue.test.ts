import { describe, expect, it } from 'vitest';
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

describe('OfflineQueue', () => {
  it('marks local inserts pending_sync and dedupes by idempotency key', async () => {
    const store = memoryStore();
    const api: SyncApi = {
      async upsertTransaction() {
        throw new Error('offline');
      },
    };
    const queue = new OfflineQueue(store, api);
    const first = await queue.enqueueLocal({
      spaceId: 'space_1',
      type: 'expense',
      amountMinor: 500,
      currency: 'USD',
      idempotencyKey: 'idem_fixed',
    });
    const second = await queue.enqueueLocal({
      spaceId: 'space_1',
      type: 'expense',
      amountMinor: 500,
      currency: 'USD',
      idempotencyKey: 'idem_fixed',
    });
    expect(first.status).toBe('pending_sync');
    expect(second.id).toBe(first.id);
    expect((await store.list()).length).toBe(1);
  });

  it('reconciles matching amounts without duplicate', async () => {
    const store = memoryStore();
    const api: SyncApi = {
      async upsertTransaction(txn) {
        return {
          ok: true,
          remote: {
            id: txn.id,
            idempotencyKey: txn.idempotencyKey,
            amountMinor: txn.amountMinor,
            updatedAt: txn.updatedAt,
            description: txn.description,
            categoryId: txn.categoryId,
            status: 'confirmed',
          },
        };
      },
    };
    const queue = new OfflineQueue(store, api);
    await queue.enqueueLocal({
      spaceId: 'space_1',
      type: 'expense',
      amountMinor: 1200,
      currency: 'USD',
    });
    const result = await queue.reconcile();
    expect(result.synced).toBe(1);
    expect(result.conflicts).toBe(0);
    expect((await store.list())[0]?.status).toBe('confirmed');
  });

  it('surfaces amount conflicts instead of silent merge', async () => {
    const store = memoryStore();
    const api: SyncApi = {
      async upsertTransaction(txn) {
        return {
          ok: true,
          remote: {
            id: txn.id,
            idempotencyKey: txn.idempotencyKey,
            amountMinor: txn.amountMinor + 1,
            updatedAt: new Date().toISOString(),
            description: 'server',
            categoryId: null,
            status: 'confirmed',
          },
        };
      },
    };
    const queue = new OfflineQueue(store, api);
    await queue.enqueueLocal({
      spaceId: 'space_1',
      type: 'expense',
      amountMinor: 100,
      currency: 'USD',
    });
    const result = await queue.reconcile();
    expect(result.conflicts).toBe(1);
    expect((await store.list())[0]?.status).toBe('conflict');
  });
});
