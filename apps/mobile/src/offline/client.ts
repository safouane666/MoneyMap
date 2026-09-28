import { OfflineQueue } from './queue';
import { createAsyncStorageStore } from './store';
import { syncTransaction } from '../lib/api';

const store = createAsyncStorageStore();

/**
 * Shared offline queue + AsyncStorage store used by Add, Activity, and Home.
 * (Previously Add used an in-memory stub while Activity read AsyncStorage.)
 */
export const offlineStore = store;

export const offlineQueue = new OfflineQueue(store, {
  async upsertTransaction(txn) {
    return syncTransaction(txn);
  },
});
