import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';
import {
  clearCachedLedger,
  loadCachedLedger,
  type MobileLedger,
} from './ledger';

const GUEST_SNAPSHOT_KEY = 'cm.mobile.guest.migrate.v1';

/** Capture local guest ledger before auth (sign-up). */
export async function snapshotGuestLedger(): Promise<MobileLedger | null> {
  const cached = await loadCachedLedger();
  if (!cached || cached.userId !== 'guest') return null;
  if (!cached.transactions.length && !cached.spaces.length) return null;
  try {
    await AsyncStorage.setItem(GUEST_SNAPSHOT_KEY, JSON.stringify(cached));
  } catch {
    /* ignore */
  }
  return cached;
}

export async function readGuestSnapshot(): Promise<MobileLedger | null> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileLedger;
  } catch {
    return null;
  }
}

export async function clearGuestSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

/** Discard guest local data when signing into an existing account. */
export async function discardGuestLedger(): Promise<void> {
  await clearGuestSnapshot();
  await clearCachedLedger();
}

/**
 * Push guest transactions into the signed-in personal space, then wipe guest caches.
 * Call after sign-up / empty new account. Do NOT call after signing into an existing account.
 */
export async function migrateGuestLedgerToSpace(
  spaceId: string,
  guest?: MobileLedger | null,
): Promise<void> {
  const state = guest ?? (await readGuestSnapshot()) ?? (await snapshotGuestLedger());
  if (!state?.transactions?.length) {
    await clearGuestSnapshot();
    await clearCachedLedger();
    return;
  }

  const categoryNameById = new Map(state.categories.map((c) => [c.id, c.name]));

  for (const txn of state.transactions) {
    if (txn.type !== 'income' && txn.type !== 'expense') continue;
    const categoryName = txn.categoryId ? categoryNameById.get(txn.categoryId) : null;
    await apiFetch(`/spaces/${spaceId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: txn.type,
        amountMinor: txn.amountMinor,
        currency: txn.currency,
        categoryId: null,
        description: txn.description
          ? txn.description
          : categoryName
            ? categoryName
            : null,
        occurredAt: txn.occurredAt,
        source: txn.source ?? 'manual',
        confirm: true,
      }),
    }).catch(() => null);
  }

  await clearGuestSnapshot();
  await clearCachedLedger();
}
