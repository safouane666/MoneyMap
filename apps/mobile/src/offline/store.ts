import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineStore, OfflineTransaction } from './queue';

const KEY = 'cm.offline.transactions';

/**
 * AsyncStorage-backed store. expo-sqlite can replace this later for larger ledgers;
 * the OfflineQueue API stays the same.
 */
export function createAsyncStorageStore(): OfflineStore {
  async function readAll(): Promise<OfflineTransaction[]> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as OfflineTransaction[];
    } catch {
      return [];
    }
  }

  async function writeAll(rows: OfflineTransaction[]): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(rows));
  }

  return {
    async list() {
      return readAll();
    },
    async get(id) {
      return (await readAll()).find((t) => t.id === id) ?? null;
    },
    async getByIdempotencyKey(key) {
      return (await readAll()).find((t) => t.idempotencyKey === key) ?? null;
    },
    async upsert(txn) {
      const rows = await readAll();
      const idx = rows.findIndex(
        (t) => t.id === txn.id || t.idempotencyKey === txn.idempotencyKey,
      );
      if (idx >= 0) rows[idx] = txn;
      else rows.push(txn);
      await writeAll(rows);
    },
    async remove(id) {
      await writeAll((await readAll()).filter((t) => t.id !== id));
    },
  };
}

/**
 * Stub for expo-sqlite persistence. Mirrors the same OfflineStore contract so
 * OfflineQueue can swap backends without changing reconcile/idempotency logic.
 */
export function createSqliteStoreStub(): OfflineStore {
  const memory = new Map<string, OfflineTransaction>();
  return {
    async list() {
      return [...memory.values()];
    },
    async get(id) {
      return memory.get(id) ?? null;
    },
    async getByIdempotencyKey(key) {
      return [...memory.values()].find((t) => t.idempotencyKey === key) ?? null;
    },
    async upsert(txn) {
      for (const [id, row] of memory) {
        if (row.idempotencyKey === txn.idempotencyKey && id !== txn.id) {
          memory.delete(id);
        }
      }
      memory.set(txn.id, txn);
    },
    async remove(id) {
      memory.delete(id);
    },
  };
}
