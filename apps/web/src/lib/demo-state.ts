import {
  computePeriodTotals,
  createId,
  type Goal,
  type LedgerTransaction,
  type SpaceRole,
} from '@clear-money/domain';

export interface DemoSpace {
  id: string;
  name: string;
  currency: string;
  role: SpaceRole;
}

export interface DemoCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface DemoState {
  spaces: DemoSpace[];
  activeSpaceId: string;
  transactions: LedgerTransaction[];
  categories: DemoCategory[];
  goals: Goal[];
  /** Soft-hidden from activity lists; still counted in totals. */
  hiddenIds: string[];
  userId: string;
}

const DEMO_KEY = 'cm.demo.state.v4';
/** Last successful API ledger — survives brief API flaps (v4 drops seeded demo junk). */
const API_CACHE_KEY = 'cm.ledger.cache.v2';

/** Empty guest ledger — no fake balances or seeded transactions. */
export function emptyState(): DemoState {
  return {
    userId: 'guest',
    activeSpaceId: '',
    spaces: [],
    categories: [],
    transactions: [],
    goals: [],
    hiddenIds: [],
  };
}

function normalizeState(parsed: Partial<DemoState>): DemoState {
  const empty = emptyState();
  if (!parsed.spaces?.length) {
    return empty;
  }
  return {
    userId: parsed.userId ?? empty.userId,
    activeSpaceId: parsed.activeSpaceId ?? parsed.spaces[0]!.id,
    spaces: parsed.spaces,
    categories: parsed.categories ?? [],
    transactions: (parsed.transactions ?? []).filter((t) => t.type !== 'transfer'),
    goals: parsed.goals ?? [],
    hiddenIds: Array.isArray(parsed.hiddenIds) ? parsed.hiddenIds : [],
  };
}

export function loadDemoState(): DemoState {
  if (typeof window === 'undefined') return emptyState();
  try {
    // Purge legacy seeded demo payloads
    localStorage.removeItem('cm.demo.state.v3');
    localStorage.removeItem('cm.ledger.cache.v1');
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw) as Partial<DemoState>);
  } catch {
    return emptyState();
  }
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
}

export function saveApiLedgerCache(state: DemoState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_CACHE_KEY, JSON.stringify(state));
}

export function loadApiLedgerCache(): DemoState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(API_CACHE_KEY);
    if (!raw) return null;
    const next = normalizeState(JSON.parse(raw) as Partial<DemoState>);
    return next.spaces.length ? next : null;
  } catch {
    return null;
  }
}

export function getActiveSpace(state: DemoState): DemoSpace {
  return (
    state.spaces.find((s) => s.id === state.activeSpaceId) ??
    state.spaces[0] ?? {
      id: '',
      name: 'No space',
      currency: 'USD',
      role: 'owner' as SpaceRole,
    }
  );
}

export function getSpaceTransactions(state: DemoState, spaceId?: string) {
  const id = spaceId ?? state.activeSpaceId;
  if (!id) return [];
  return state.transactions.filter((t) => t.spaceId === id);
}

export function getVisibleSpaceTransactions(state: DemoState, spaceId?: string) {
  const hidden = new Set(state.hiddenIds);
  return getSpaceTransactions(state, spaceId).filter((t) => !hidden.has(t.id));
}

export function getSpaceTotals(state: DemoState, spaceId?: string) {
  const space = spaceId
    ? state.spaces.find((s) => s.id === spaceId)
    : state.spaces.length
      ? getActiveSpace(state)
      : undefined;
  const currency = space?.currency ?? 'USD';
  return computePeriodTotals(getSpaceTransactions(state, space?.id), currency);
}

/** Expense totals by category for charts (no fake data). */
export function categoryBreakdown(
  state: DemoState,
  spaceId?: string,
): Array<{ name: string; amountMinor: number }> {
  const id = spaceId ?? state.activeSpaceId;
  const catName = new Map(state.categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const txn of getSpaceTransactions(state, id)) {
    if (txn.type !== 'expense' || txn.status !== 'confirmed') continue;
    const key = txn.categoryId ?? '__uncategorized__';
    totals.set(key, (totals.get(key) ?? 0) + txn.amountMinor);
  }
  return [...totals.entries()]
    .map(([key, amountMinor]) => ({
      name: key === '__uncategorized__' ? 'Other' : catName.get(key) ?? 'Other',
      amountMinor,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function addDemoTransaction(
  state: DemoState,
  input: Omit<LedgerTransaction, 'id' | 'createdAt' | 'createdBy' | 'status' | 'source'> & {
    source?: LedgerTransaction['source'];
  },
): { state: DemoState; transaction: LedgerTransaction } {
  const transaction: LedgerTransaction = {
    ...input,
    id: createId('txn'),
    createdAt: new Date().toISOString(),
    createdBy: state.userId,
    source: input.source ?? 'manual',
    status: 'confirmed',
  };
  return {
    transaction,
    state: {
      ...state,
      transactions: [transaction, ...state.transactions],
    },
  };
}

export function updateDemoTransaction(
  state: DemoState,
  id: string,
  patch: { description?: string | null; categoryId?: string | null },
): DemoState {
  return {
    ...state,
    transactions: state.transactions.map((t) =>
      t.id === id
        ? {
            ...t,
            description: patch.description !== undefined ? patch.description : t.description,
            categoryId: patch.categoryId !== undefined ? patch.categoryId : t.categoryId,
          }
        : t,
    ),
  };
}

export function removeDemoTransaction(state: DemoState, id: string): DemoState {
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== id),
    hiddenIds: state.hiddenIds.filter((hid) => hid !== id),
  };
}

export function restoreDemoTransaction(
  state: DemoState,
  transaction: LedgerTransaction,
): DemoState {
  if (state.transactions.some((t) => t.id === transaction.id)) return state;
  return {
    ...state,
    transactions: [transaction, ...state.transactions],
  };
}

export function hideDemoTransaction(state: DemoState, id: string): DemoState {
  if (state.hiddenIds.includes(id)) return state;
  return { ...state, hiddenIds: [...state.hiddenIds, id] };
}

export function unhideDemoTransaction(state: DemoState, id: string): DemoState {
  return { ...state, hiddenIds: state.hiddenIds.filter((hid) => hid !== id) };
}

export function addDemoCategory(
  state: DemoState,
  input: { name: string; type: 'income' | 'expense' },
): { state: DemoState; category: DemoCategory } {
  const category: DemoCategory = {
    id: createId('cat'),
    name: input.name.trim(),
    type: input.type,
  };
  return {
    category,
    state: { ...state, categories: [...state.categories, category] },
  };
}

export function setActiveSpace(state: DemoState, spaceId: string): DemoState {
  if (!state.spaces.some((s) => s.id === spaceId)) return state;
  return { ...state, activeSpaceId: spaceId };
}
