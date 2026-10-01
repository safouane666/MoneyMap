import { createId, defaultCategoryRows } from '@clear-money/domain';
import { apiFetch } from '@/lib/api';
import {
  loadApiLedgerCache,
  loadDemoState,
  saveDemoState,
  type DemoCategory,
  type DemoState,
} from '@/lib/demo-state';
import { clearLocalSessionCaches } from '@/lib/session-cache';

const GUEST_SNAPSHOT_KEY = 'cm.guest.migrate.v1';

function withDefaultCategories(state: DemoState): DemoState {
  const existingKeys = new Set(
    state.categories.filter((c) => c.spaceId == null).map((c) => c.stableKey ?? c.id),
  );
  const missing: DemoCategory[] = defaultCategoryRows()
    .filter((row) => !existingKeys.has(row.stableKey) && !existingKeys.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      spaceId: null,
      stableKey: row.stableKey,
    }));
  if (!missing.length) return state;
  return { ...state, categories: [...missing, ...state.categories] };
}

/** Ensure a guest ledger has a Personal space (currency from setup). */
export function ensureGuestPersonalSpace(state: DemoState, currency = 'USD'): DemoState {
  let next = withDefaultCategories(state);
  if (next.spaces.length > 0) {
    if (next !== state) saveDemoState(next);
    return next;
  }
  const id = createId('space');
  next = {
    ...next,
    userId: 'guest',
    activeSpaceId: id,
    spaces: [{ id, name: 'Personal', currency: currency.toUpperCase(), role: 'owner' }],
  };
  saveDemoState(next);
  return next;
}

/** Capture local guest ledger before auth (sign-up / Google). */
export function snapshotGuestLedger(): DemoState | null {
  if (typeof window === 'undefined') return null;
  const cached = loadApiLedgerCache();
  const demo = loadDemoState();
  const pick =
    (cached?.transactions?.length ?? 0) > 0 || (cached?.spaces?.length ?? 0) > 0
      ? cached
      : (demo.transactions.length > 0 || demo.spaces.length > 0)
        ? demo
        : null;
  if (!pick) return null;
  try {
    sessionStorage.setItem(GUEST_SNAPSHOT_KEY, JSON.stringify(pick));
  } catch {
    /* ignore */
  }
  return pick;
}

export function readGuestSnapshot(): DemoState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoState;
  } catch {
    return null;
  }
}

export function clearGuestSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(GUEST_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Push guest transactions into the signed-in personal space, then wipe local guest caches.
 * Call after sign-up / empty new account. Do NOT call after signing into an existing account.
 */
export async function migrateGuestLedgerToSpace(spaceId: string, guest?: DemoState | null): Promise<void> {
  const state = guest ?? readGuestSnapshot() ?? snapshotGuestLedger();
  if (!state?.transactions?.length) {
    clearGuestSnapshot();
    clearLocalSessionCaches();
    try {
      localStorage.removeItem('cm.demo.state.v4');
      localStorage.removeItem('cm.ledger.cache.v2');
    } catch {
      /* ignore */
    }
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
      timeoutMs: 20_000,
    }).catch(() => null);
  }

  clearGuestSnapshot();
  clearLocalSessionCaches();
  try {
    localStorage.removeItem('cm.demo.state.v4');
    localStorage.removeItem('cm.ledger.cache.v2');
  } catch {
    /* ignore */
  }
}
