import { createId, createIdempotencyKey } from '@clear-money/domain';

export type OfflineTxnType = 'income' | 'expense' | 'transfer';

export interface OfflineTransaction {
  id: string;
  spaceId: string;
  type: OfflineTxnType;
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  status: 'pending_sync' | 'confirmed' | 'draft' | 'conflict';
  idempotencyKey: string;
  /** Set when server rejected a silent amount merge. */
  conflictReason?: string;
}

export interface SyncRemoteTransaction {
  id: string;
  idempotencyKey: string;
  amountMinor: number;
  updatedAt: string;
  description: string | null;
  categoryId: string | null;
  status: string;
}

export interface SyncApi {
  upsertTransaction: (
    txn: OfflineTransaction,
  ) => Promise<{ ok: true; remote: SyncRemoteTransaction } | { ok: false; error: string }>;
}

export interface OfflineStore {
  list(): Promise<OfflineTransaction[]>;
  get(id: string): Promise<OfflineTransaction | null>;
  getByIdempotencyKey(key: string): Promise<OfflineTransaction | null>;
  upsert(txn: OfflineTransaction): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * In-memory / AsyncStorage-backed offline queue.
 * Local inserts are visible immediately as pending_sync and reconcile via idempotency keys.
 *
 * Conflict rule: last-write-wins on non-amount fields; amount mismatches surface a review
 * (never silently merge amounts).
 */
export class OfflineQueue {
  constructor(
    private readonly store: OfflineStore,
    private readonly api: SyncApi,
  ) {}

  async enqueueLocal(input: {
    spaceId: string;
    type: OfflineTxnType;
    amountMinor: number;
    currency: string;
    categoryId?: string | null;
    description?: string | null;
    occurredAt?: string;
    idempotencyKey?: string;
  }): Promise<OfflineTransaction> {
    const key = input.idempotencyKey ?? createIdempotencyKey();
    const existing = await this.store.getByIdempotencyKey(key);
    if (existing) return existing;

    const now = new Date().toISOString();
    const txn: OfflineTransaction = {
      id: createId('txn'),
      spaceId: input.spaceId,
      type: input.type,
      amountMinor: input.amountMinor,
      currency: input.currency,
      categoryId: input.categoryId ?? null,
      description: input.description ?? null,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
      updatedAt: now,
      status: 'pending_sync',
      idempotencyKey: key,
    };
    await this.store.upsert(txn);
    return txn;
  }

  async reconcile(): Promise<{ synced: number; conflicts: number }> {
    const pending = (await this.store.list()).filter((t) => t.status === 'pending_sync');
    let synced = 0;
    let conflicts = 0;

    for (const local of pending) {
      const result = await this.api.upsertTransaction(local);
      if (!result.ok) {
        continue;
      }

      const remote = result.remote;
      if (remote.amountMinor !== local.amountMinor) {
        await this.store.upsert({
          ...local,
          status: 'conflict',
          conflictReason:
            'Amount differs from server. Review before saving — amounts are never merged silently.',
          updatedAt: new Date().toISOString(),
        });
        conflicts += 1;
        continue;
      }

      // Last-write-wins for non-amount fields
      const remoteNewer = Date.parse(remote.updatedAt) >= Date.parse(local.updatedAt);
      await this.store.upsert({
        ...local,
        id: remote.id,
        description: remoteNewer ? remote.description : local.description,
        categoryId: remoteNewer ? remote.categoryId : local.categoryId,
        status: 'confirmed',
        updatedAt: new Date().toISOString(),
      });
      synced += 1;
    }

    return { synced, conflicts };
  }
}
