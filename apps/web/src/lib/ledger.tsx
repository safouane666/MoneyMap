'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addMonthsToIsoDate,
  createId,
  type Goal,
  type LedgerTransaction,
  type SpaceRole,
} from '@clear-money/domain';
import { apiFetch, ApiError } from '@/lib/api';
import { loadSetupSession } from '@/lib/setup-session';
import { useToast } from '@/components/Toast';
import {
  addDemoCategory,
  addDemoTransaction,
  hideDemoTransaction,
  loadApiLedgerCache,
  loadDemoState,
  removeDemoTransaction,
  restoreDemoTransaction,
  saveApiLedgerCache,
  saveDemoState,
  setActiveSpace as setDemoActiveSpace,
  unhideDemoTransaction,
  updateDemoTransaction,
  type DemoCategory,
  type DemoState,
  type RecurringItem,
} from '@/lib/demo-state';
import { ensureGuestPersonalSpace } from '@/lib/guest-migrate';

export type { RecurringItem };

interface LedgerContextValue {
  state: DemoState;
  offline: boolean;
  ready: boolean;
  signedIn: boolean;
  sessionUser: SessionUser | null;
  showLoginPrompt: boolean;
  dismissLoginPrompt: () => void;
  refresh: () => Promise<boolean>;
  setSpace: (spaceId: string) => void;
  createSpace: (input: {
    name: string;
    type?: string;
    currency?: string;
  }) => Promise<{ id: string; name: string; currency: string; role: SpaceRole }>;
  updateSpace: (
    spaceId: string,
    patch: { name?: string; currency?: string },
  ) => Promise<{ id: string; name: string; currency: string }>;
  createGoal: (input: {
    name: string;
    targetMinor: number;
    currency: string;
    durationMonths: number;
    startDate?: string;
    plannedContributionMinor?: number;
  }) => Promise<Goal>;
  evaluateGoal: (id: string, asOfDate?: string) => Promise<Goal | null>;
  updateGoal: (
    id: string,
    patch: {
      name?: string;
      targetMinor?: number;
      savedMinor?: number;
      plannedContributionMinor?: number;
      status?: string;
    },
  ) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  createRecurring: (input: {
    name: string;
    amountMinor: number;
    kind: 'income' | 'expense';
    dayOfMonth: number;
  }) => Promise<RecurringItem>;
  updateRecurring: (
    id: string,
    patch: {
      name?: string;
      amountMinor?: number;
      kind?: 'income' | 'expense';
      dayOfMonth?: number;
      active?: boolean;
    },
  ) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  addTransaction: (
    input: Omit<LedgerTransaction, 'id' | 'createdAt' | 'createdBy' | 'status' | 'source'> & {
      source?: LedgerTransaction['source'];
    },
  ) => LedgerTransaction;
  updateTransaction: (
    id: string,
    patch: {
      description?: string | null;
      categoryId?: string | null;
      amountMinor?: number;
      occurredAt?: string;
    },
  ) => void;
  undoTransaction: (id: string) => void;
  restoreTransaction: (transaction: LedgerTransaction) => void;
  hideTransaction: (id: string) => void;
  unhideTransaction: (id: string) => void;
  addCategory: (input: { name: string; type: 'income' | 'expense' }) => DemoCategory;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  plan: string;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

const EMPTY: DemoState = {
  userId: 'guest',
  activeSpaceId: '',
  spaces: [],
  categories: [],
  transactions: [],
  goals: [],
  recurring: [],
  hiddenIds: [],
};

const ACTIVE_SPACE_KEY = 'cm.activeSpaceId';
const HIDDEN_IDS_KEY = 'cm.hiddenIds.v1';

type ApiSpace = {
  id: string;
  name: string;
  currency: string;
  role: SpaceRole;
};

type ApiCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense' | string;
  spaceId?: string | null;
  stableKey?: string | null;
};

type ApiTxn = {
  id: string;
  spaceId: string;
  type: LedgerTransaction['type'] | string;
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  occurredAt: string;
  createdAt?: string;
  createdBy: string;
  source: LedgerTransaction['source'] | string;
  status: LedgerTransaction['status'] | string;
};

type ApiGoal = Goal & { createdBy?: string; createdAt?: string; deletedAt?: string | null };

type ApiRecurring = RecurringItem & {
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

type ApiMe = {
  id: string;
  name?: string | null;
  email?: string | null;
  plan?: string | null;
  defaultCurrency?: string | null;
  setupSession?: { completed?: boolean; needsPersonalSpace?: boolean } | null;
} | null;

const LOGIN_PROMPT_KEY = 'cm.login.prompt.dismissed';

function mapSessionUser(me: ApiMe): SessionUser | null {
  if (!me?.id) return null;
  return {
    id: me.id,
    name: me.name?.trim() || me.email || 'Account',
    email: me.email ?? '',
    plan: me.plan ?? 'free',
  };
}

function toIso(value: string | Date | undefined | null): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function mapTxn(row: ApiTxn): LedgerTransaction {
  return {
    id: row.id,
    spaceId: row.spaceId,
    type: row.type as LedgerTransaction['type'],
    amountMinor: row.amountMinor,
    currency: row.currency,
    categoryId: row.categoryId,
    description: row.description,
    occurredAt: toIso(row.occurredAt),
    createdAt: toIso(row.createdAt ?? row.occurredAt),
    createdBy: row.createdBy,
    source: row.source as LedgerTransaction['source'],
    status: row.status as LedgerTransaction['status'],
  };
}

function mapRecurring(row: ApiRecurring): RecurringItem {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    amountMinor: row.amountMinor,
    currency: row.currency,
    kind: row.kind,
    dayOfMonth: row.dayOfMonth,
    nextDueAt: row.nextDueAt,
    active: row.active,
    notifyHoursBefore: row.notifyHoursBefore ?? 0,
  };
}

function mapGoal(row: ApiGoal): Goal {
  const durationMonths =
    row.durationMonths !== undefined && row.durationMonths >= 1
      ? Math.floor(row.durationMonths)
      : undefined;
  const plannedContributionMinor = row.plannedContributionMinor ?? 0;
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    targetMinor: row.targetMinor,
    savedMinor: row.savedMinor,
    currency: row.currency,
    targetDate: row.targetDate,
    startDate: row.startDate ?? undefined,
    durationMonths,
    plannedContributionMinor,
    paceStatus: row.paceStatus,
    notificationPolicy: row.notificationPolicy,
    status: row.status,
  };
}

function readHiddenIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HIDDEN_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeHiddenIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HIDDEN_IDS_KEY, JSON.stringify(ids));
}

function readPreferredSpaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SPACE_KEY);
}

function writePreferredSpaceId(spaceId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_SPACE_KEY, spaceId);
}

async function loadLedgerFromApi(): Promise<{ state: DemoState; sessionUser: SessionUser | null } | null> {
  const meResult = await apiFetch<ApiMe>('/me');
  if (meResult.offline) return null;
  if (!meResult.data?.id) return null;

  const sessionUser = mapSessionUser(meResult.data);

  const setup = loadSetupSession();
  const setupPayload = {
    locale: setup.language,
    defaultCurrency: setup.currency,
    notificationEnabled: setup.notificationsEnabled,
  };

  if (meResult.data.setupSession?.needsPersonalSpace) {
    await apiFetch('/me/setup-complete', {
      method: 'POST',
      body: JSON.stringify(setupPayload),
    }).catch(() => null);
    await apiFetch('/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan: 'free' }),
    }).catch(() => null);
  } else if (
    setup.completedSteps.includes('currency') &&
    setup.currency &&
    (meResult.data.defaultCurrency ?? 'USD').toUpperCase() !== setup.currency.toUpperCase()
  ) {
    // OAuth / early bootstrap may have created a USD personal space; re-apply setup currency
    // while the ledger is still empty (API no-ops once transactions exist).
    await apiFetch('/me/setup-complete', {
      method: 'POST',
      body: JSON.stringify(setupPayload),
    }).catch(() => null);
  }

  let spacesResult = await apiFetch<ApiSpace[]>('/spaces');
  if (spacesResult.offline) {
    return {
      sessionUser,
      state: {
        userId: meResult.data.id,
        activeSpaceId: '',
        spaces: [],
        categories: [],
        transactions: [],
        goals: [],
        recurring: [],
        hiddenIds: readHiddenIds(),
      },
    };
  }

  if (!spacesResult.data?.length) {
    await apiFetch('/me/setup-complete', {
      method: 'POST',
      body: JSON.stringify(setupPayload),
    }).catch(() => null);
    spacesResult = await apiFetch<ApiSpace[]>('/spaces');
  }

  const spaces = (spacesResult.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    currency: s.currency,
    role: s.role,
  }));

  if (!spaces.length) {
    return {
      sessionUser,
      state: {
        userId: meResult.data.id,
        activeSpaceId: '',
        spaces: [],
        categories: [],
        transactions: [],
        goals: [],
        recurring: [],
        hiddenIds: readHiddenIds(),
      },
    };
  }

  const preferred = readPreferredSpaceId();
  const activeSpaceId =
    (preferred && spaces.some((s) => s.id === preferred) ? preferred : null) ?? spaces[0]!.id;

  const [categoriesResult, ...spacePayloads] = await Promise.all([
    apiFetch<ApiCategory[]>('/categories'),
    ...spaces.map(async (space) => {
      const [txns, goals, recurring] = await Promise.all([
        apiFetch<ApiTxn[]>(`/spaces/${space.id}/transactions`),
        apiFetch<ApiGoal[]>(`/spaces/${space.id}/goals`),
        apiFetch<ApiRecurring[]>(`/spaces/${space.id}/recurring`),
      ]);
      return { spaceId: space.id, txns, goals, recurring };
    }),
  ]);

  const transactions: LedgerTransaction[] = [];
  const goals: Goal[] = [];
  const recurring: RecurringItem[] = [];
  if (!categoriesResult.offline) {
    for (const payload of spacePayloads) {
      if (payload.txns.offline || payload.goals.offline || payload.recurring.offline) continue;
      for (const row of payload.txns.data ?? []) {
        if (row.type === 'transfer') continue;
        transactions.push(mapTxn(row));
      }
      for (const row of payload.goals.data ?? []) {
        goals.push(mapGoal(row));
      }
      for (const row of payload.recurring.data ?? []) {
        recurring.push(mapRecurring(row));
      }
    }
  }

  transactions.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const categories: DemoCategory[] = (categoriesResult.data ?? [])
    .filter((c) => c.type === 'income' || c.type === 'expense')
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as 'income' | 'expense',
      spaceId: c.spaceId ?? null,
      stableKey: c.stableKey ?? null,
    }));

  return {
    sessionUser,
    state: {
      userId: meResult.data.id,
      activeSpaceId,
      spaces,
      categories,
      transactions,
      goals,
      recurring,
      hiddenIds: readHiddenIds(),
    },
  };
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [state, setState] = useState<DemoState>(EMPTY);
  const [offline, setOffline] = useState(true);
  const [ready, setReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const stateRef = useRef(state);
  const offlineRef = useRef(true);
  stateRef.current = state;
  offlineRef.current = offline;

  const noteUnsignedWrite = useCallback(() => {
    if (!offlineRef.current) return;
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(LOGIN_PROMPT_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    setShowLoginPrompt(true);
  }, []);

  const dismissLoginPrompt = useCallback(() => {
    setShowLoginPrompt(false);
    try {
      localStorage.setItem(LOGIN_PROMPT_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const commit = useCallback((next: DemoState, opts?: { persistCache?: boolean }) => {
    stateRef.current = next;
    setState(next);
    if (offlineRef.current) {
      // Guest / offline ledger must survive relaunch and account transfer.
      saveDemoState(next);
      return;
    }
    if (opts?.persistCache !== false) {
      saveApiLedgerCache(next);
    }
  }, []);

  const applyDemo = useCallback(() => {
    setSessionUser(null);
    const currency = loadSetupSession().currency || 'USD';
    const cached = loadApiLedgerCache();
    if (cached?.spaces?.length) {
      commit(ensureGuestPersonalSpace(cached, currency), { persistCache: true });
      setOffline(true);
      offlineRef.current = true;
      return;
    }
    const demo = ensureGuestPersonalSpace(loadDemoState(), currency);
    commit(demo);
    setOffline(true);
    offlineRef.current = true;
  }, [commit]);

  const refreshFromApi = useCallback(async (): Promise<boolean> => {
    try {
      const remote = await loadLedgerFromApi();
      if (!remote) {
        applyDemo();
        return false;
      }
      saveApiLedgerCache(remote.state);
      try {
        localStorage.removeItem('cm.demo.state.v3');
      } catch {
        /* ignore */
      }
      writePreferredSpaceId(remote.state.activeSpaceId);
      setSessionUser(remote.sessionUser);
      commit(remote.state, { persistCache: true });
      setOffline(false);
      offlineRef.current = false;
      setShowLoginPrompt(false);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        applyDemo();
        return false;
      }
      applyDemo();
      return false;
    }
  }, [applyDemo, commit]);

  const refresh = useCallback(async () => {
    const ok = await refreshFromApi();
    if (!ok) applyDemo();
    return ok;
  }, [applyDemo, refreshFromApi]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const health = await apiFetch<{ ok: boolean }>('/health');
      if (cancelled) return;
      if (health.offline) {
        applyDemo();
        setReady(true);
        return;
      }
      const ok = await refreshFromApi();
      if (cancelled) return;
      if (!ok) applyDemo();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDemo, refreshFromApi]);

  const setSpace = useCallback(
    (spaceId: string) => {
      if (offlineRef.current) {
        commit(setDemoActiveSpace(stateRef.current, spaceId));
        return;
      }
      writePreferredSpaceId(spaceId);
      commit({ ...stateRef.current, activeSpaceId: spaceId });
    },
    [commit],
  );

  const createSpace = useCallback(
    async (input: { name: string; type?: string; currency?: string }) => {
      const name = input.name.trim();
      if (!name) throw new ApiError('Name required', 400);
      const currency =
        input.currency ??
        stateRef.current.spaces.find((s) => s.id === stateRef.current.activeSpaceId)?.currency ??
        'USD';
      const result = await apiFetch<{
        id: string;
        name: string;
        currency: string;
        role: SpaceRole;
      }>('/spaces', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type: input.type ?? 'shared',
          currency,
        }),
      });
      if (result.offline || !result.data) {
        throw new ApiError('API is offline', 503);
      }
      const created = result.data;
      writePreferredSpaceId(created.id);
      const ok = await refreshFromApi();
      if (!ok) {
        const next: DemoState = {
          ...stateRef.current,
          activeSpaceId: created.id,
          spaces: [
            ...stateRef.current.spaces.filter((s) => s.id !== created.id),
            {
              id: created.id,
              name: created.name,
              currency: created.currency,
              role: created.role,
            },
          ],
        };
        commit(next, { persistCache: true });
        setOffline(false);
        offlineRef.current = false;
      } else {
        setSpace(created.id);
      }
      return created;
    },
    [commit, refreshFromApi, setSpace],
  );

  const updateSpace = useCallback(
    async (spaceId: string, patch: { name?: string; currency?: string }) => {
      const existing = stateRef.current.spaces.find((s) => s.id === spaceId);
      if (!existing) throw new ApiError('Space not found', 404);

      const currency = patch.currency?.trim().toUpperCase();
      const name = patch.name?.trim();

      if (offlineRef.current) {
        const next = {
          ...stateRef.current,
          spaces: stateRef.current.spaces.map((s) =>
            s.id === spaceId
              ? {
                  ...s,
                  ...(name ? { name } : {}),
                  ...(currency ? { currency } : {}),
                }
              : s,
          ),
        };
        commit(next);
        noteUnsignedWrite();
        return {
          id: spaceId,
          name: name ?? existing.name,
          currency: currency ?? existing.currency,
        };
      }

      const result = await apiFetch<{ id: string; name: string; currency: string }>(
        `/spaces/${spaceId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            ...(name ? { name } : {}),
            ...(currency ? { currency } : {}),
          }),
        },
      );
      if (result.offline || !result.data) {
        throw new ApiError('API is offline', 503);
      }

      if (currency) {
        await apiFetch('/me', {
          method: 'PATCH',
          body: JSON.stringify({ defaultCurrency: currency }),
        }).catch(() => null);
      }

      commit({
        ...stateRef.current,
        spaces: stateRef.current.spaces.map((s) =>
          s.id === spaceId
            ? {
                ...s,
                name: result.data!.name,
                currency: result.data!.currency,
              }
            : s,
        ),
      });

      return {
        id: result.data.id,
        name: result.data.name,
        currency: result.data.currency,
      };
    },
    [commit, noteUnsignedWrite],
  );

  const addTransaction = useCallback(
    (
      input: Omit<LedgerTransaction, 'id' | 'createdAt' | 'createdBy' | 'status' | 'source'> & {
        source?: LedgerTransaction['source'];
      },
    ) => {
      if (offlineRef.current) {
        const result = addDemoTransaction(stateRef.current, input);
        commit(result.state);
        noteUnsignedWrite();
        return result.transaction;
      }

      const optimistic: LedgerTransaction = {
        ...input,
        id: createId('txn'),
        createdAt: new Date().toISOString(),
        createdBy: stateRef.current.userId,
        source: input.source ?? 'manual',
        status: 'confirmed',
      };
      commit({
        ...stateRef.current,
        transactions: [optimistic, ...stateRef.current.transactions],
      });

      void (async () => {
        try {
          const result = await apiFetch<ApiTxn>(`/spaces/${input.spaceId}/transactions`, {
            method: 'POST',
            body: JSON.stringify({
              type: input.type,
              amountMinor: input.amountMinor,
              currency: input.currency,
              categoryId: input.categoryId ?? null,
              description: input.description ?? null,
              occurredAt: input.occurredAt,
              source: input.source ?? 'manual',
              confirm: true,
            }),
          });
          if (result.offline || !result.data) {
            applyDemo();
            return;
          }
          const saved = mapTxn(result.data);
          const current = stateRef.current;
          commit({
            ...current,
            transactions: [
              saved,
              ...current.transactions.filter((t) => t.id !== optimistic.id && t.id !== saved.id),
            ],
          });
        } catch (error) {
          commit({
            ...stateRef.current,
            transactions: stateRef.current.transactions.filter((t) => t.id !== optimistic.id),
          });
          const message =
            error instanceof ApiError
              ? error.message
              : 'Could not save transaction. Check your connection and try again.';
          showToast({ message });
        }
      })();

      return optimistic;
    },
    [applyDemo, commit, noteUnsignedWrite, showToast],
  );

  const updateTransaction = useCallback(
    (
      id: string,
      patch: {
        description?: string | null;
        categoryId?: string | null;
        amountMinor?: number;
        occurredAt?: string;
      },
    ) => {
      if (offlineRef.current) {
        commit(updateDemoTransaction(stateRef.current, id, patch));
        return;
      }
      const current = stateRef.current;
      const existing = current.transactions.find((t) => t.id === id);
      commit({
        ...current,
        transactions: current.transactions.map((t) =>
          t.id === id
            ? {
                ...t,
                description: patch.description !== undefined ? patch.description : t.description,
                categoryId: patch.categoryId !== undefined ? patch.categoryId : t.categoryId,
                amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : t.amountMinor,
                occurredAt: patch.occurredAt !== undefined ? patch.occurredAt : t.occurredAt,
              }
            : t,
        ),
      });
      if (!existing) return;
      void apiFetch(`/spaces/${existing.spaceId}/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
          ...(patch.amountMinor !== undefined ? { amountMinor: patch.amountMinor } : {}),
          ...(patch.occurredAt !== undefined ? { occurredAt: patch.occurredAt } : {}),
        }),
      }).catch((error) => {
        showToast({
          message:
            error instanceof ApiError
              ? error.message
              : 'Could not update transaction.',
        });
      });
    },
    [commit, showToast],
  );

  const undoTransaction = useCallback(
    (id: string) => {
      if (offlineRef.current) {
        commit(removeDemoTransaction(stateRef.current, id));
        return;
      }
      const existing = stateRef.current.transactions.find((t) => t.id === id);
      const hiddenIds = stateRef.current.hiddenIds.filter((hid) => hid !== id);
      commit({
        ...stateRef.current,
        transactions: stateRef.current.transactions.filter((t) => t.id !== id),
        hiddenIds,
      });
      writeHiddenIds(hiddenIds);
      if (!existing) return;
      void apiFetch(`/spaces/${existing.spaceId}/transactions/${id}`, {
        method: 'DELETE',
      }).catch((error) => {
        commit({
          ...stateRef.current,
          transactions: [existing, ...stateRef.current.transactions],
        });
        showToast({
          message:
            error instanceof ApiError
              ? error.message
              : 'Could not undo transaction. It was restored locally.',
        });
      });
    },
    [commit, showToast],
  );

  const restoreTransaction = useCallback(
    (transaction: LedgerTransaction) => {
      if (offlineRef.current) {
        commit(restoreDemoTransaction(stateRef.current, transaction));
        return;
      }
      if (stateRef.current.transactions.some((t) => t.id === transaction.id)) return;
      commit({
        ...stateRef.current,
        transactions: [transaction, ...stateRef.current.transactions],
      });
      void (async () => {
        try {
          const result = await apiFetch<ApiTxn>(`/spaces/${transaction.spaceId}/transactions`, {
            method: 'POST',
            body: JSON.stringify({
              type: transaction.type,
              amountMinor: transaction.amountMinor,
              currency: transaction.currency,
              categoryId: transaction.categoryId,
              description: transaction.description,
              occurredAt: transaction.occurredAt,
              source: transaction.source,
              confirm: true,
            }),
          });
          if (result.offline || !result.data) return;
          const saved = mapTxn(result.data);
          const current = stateRef.current;
          commit({
            ...current,
            transactions: [
              saved,
              ...current.transactions.filter((t) => t.id !== transaction.id && t.id !== saved.id),
            ],
          });
        } catch {
          // keep optimistic restore
        }
      })();
    },
    [commit],
  );

  const hideTransaction = useCallback(
    (id: string) => {
      if (offlineRef.current) {
        commit(hideDemoTransaction(stateRef.current, id));
        return;
      }
      if (stateRef.current.hiddenIds.includes(id)) return;
      const hiddenIds = [...stateRef.current.hiddenIds, id];
      writeHiddenIds(hiddenIds);
      commit({ ...stateRef.current, hiddenIds });
    },
    [commit],
  );

  const unhideTransaction = useCallback(
    (id: string) => {
      if (offlineRef.current) {
        commit(unhideDemoTransaction(stateRef.current, id));
        return;
      }
      const hiddenIds = stateRef.current.hiddenIds.filter((hid) => hid !== id);
      writeHiddenIds(hiddenIds);
      commit({ ...stateRef.current, hiddenIds });
    },
    [commit],
  );

  const addCategory = useCallback(
    (input: { name: string; type: 'income' | 'expense' }) => {
      if (offlineRef.current) {
        const result = addDemoCategory(stateRef.current, {
          ...input,
          spaceId: stateRef.current.activeSpaceId,
        });
        commit(result.state);
        return result.category;
      }
      const optimistic: DemoCategory = {
        id: createId('cat'),
        name: input.name.trim(),
        type: input.type,
        spaceId: stateRef.current.activeSpaceId,
      };
      commit({
        ...stateRef.current,
        categories: [...stateRef.current.categories, optimistic],
      });
      void (async () => {
        try {
          const result = await apiFetch<ApiCategory>('/categories', {
            method: 'POST',
            body: JSON.stringify({
              name: input.name,
              type: input.type,
              spaceId: stateRef.current.activeSpaceId,
            }),
          });
          if (result.offline || !result.data) return;
          const saved: DemoCategory = {
            id: result.data.id,
            name: result.data.name,
            type: result.data.type as 'income' | 'expense',
            spaceId: result.data.spaceId ?? stateRef.current.activeSpaceId,
            stableKey: result.data.stableKey ?? null,
          };
          const current = stateRef.current;
          commit({
            ...current,
            categories: current.categories.map((c) => (c.id === optimistic.id ? saved : c)),
            transactions: current.transactions.map((t) =>
              t.categoryId === optimistic.id ? { ...t, categoryId: saved.id } : t,
            ),
          });
        } catch {
          // keep optimistic category
        }
      })();
      return optimistic;
    },
    [commit],
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit({
        ...stateRef.current,
        categories: stateRef.current.categories.map((c) =>
          c.id === id ? { ...c, name: trimmed } : c,
        ),
      });
      if (offlineRef.current) return;
      void apiFetch(`/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      }).catch((error) => {
        showToast({
          message:
            error instanceof ApiError ? error.message : 'Could not rename category.',
        });
      });
    },
    [commit, showToast],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      commit({
        ...stateRef.current,
        categories: stateRef.current.categories.filter((c) => c.id !== id),
        transactions: stateRef.current.transactions.map((t) =>
          t.categoryId === id ? { ...t, categoryId: null } : t,
        ),
      });
      if (offlineRef.current) return;
      void apiFetch(`/categories/${id}`, { method: 'DELETE' }).catch((error) => {
        showToast({
          message:
            error instanceof ApiError ? error.message : 'Could not delete category.',
        });
      });
    },
    [commit, showToast],
  );

  const createGoal = useCallback(
    async (input: {
      name: string;
      targetMinor: number;
      currency: string;
      durationMonths: number;
      startDate?: string;
      plannedContributionMinor?: number;
    }) => {
      if (offlineRef.current) throw new ApiError('Sign in to create goals', 401);
      const spaceId = stateRef.current.activeSpaceId;
      const durationMonths =
        Number.isFinite(input.durationMonths) && input.durationMonths >= 1
          ? Math.floor(input.durationMonths)
          : 1;
      const startDate = (input.startDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
      const targetDate = addMonthsToIsoDate(startDate, durationMonths);
      const body: Record<string, unknown> = {
        name: input.name.trim(),
        targetMinor: input.targetMinor,
        currency: input.currency,
        startDate,
        durationMonths,
        targetDate,
      };
      if (input.plannedContributionMinor !== undefined && input.plannedContributionMinor > 0) {
        body.plannedContributionMinor = input.plannedContributionMinor;
      }
      const result = await apiFetch<ApiGoal>(`/spaces/${spaceId}/goals`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (result.offline || !result.data) throw new ApiError('API is offline', 503);
      const serverGoal = mapGoal({ ...result.data, spaceId });
      commit({
        ...stateRef.current,
        goals: [...stateRef.current.goals.filter((g) => g.id !== serverGoal.id), serverGoal],
      });
      return serverGoal;
    },
    [commit],
  );

  const evaluateGoal = useCallback(
    async (id: string, asOfDate?: string) => {
      if (offlineRef.current) return null;
      const existing = stateRef.current.goals.find((g) => g.id === id);
      if (!existing) return null;
      const result = await apiFetch<{ goal: ApiGoal }>(
        `/spaces/${existing.spaceId}/goals/${id}/evaluate`,
        {
          method: 'POST',
          body: JSON.stringify({ asOfDate: asOfDate?.slice(0, 10) }),
        },
      );
      if (result.offline || !result.data?.goal) return null;
      const saved = mapGoal(result.data.goal);
      commit({
        ...stateRef.current,
        goals: stateRef.current.goals.map((g) => (g.id === id ? saved : g)),
      });
      return saved;
    },
    [commit],
  );

  const updateGoal = useCallback(
    async (
      id: string,
      patch: {
        name?: string;
        targetMinor?: number;
        savedMinor?: number;
        plannedContributionMinor?: number;
        status?: string;
      },
    ) => {
      if (offlineRef.current) throw new ApiError('Sign in to update goals', 401);
      const existing = stateRef.current.goals.find((g) => g.id === id);
      if (!existing) throw new ApiError('Goal not found', 404);
      commit({
        ...stateRef.current,
        goals: stateRef.current.goals.map((g) =>
          g.id === id
            ? {
                ...g,
                ...patch,
                status: (patch.status as Goal['status']) ?? g.status,
              }
            : g,
        ),
      });
      const result = await apiFetch<ApiGoal>(`/spaces/${existing.spaceId}/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (result.offline || !result.data) return;
      let saved = mapGoal(result.data);
      commit({
        ...stateRef.current,
        goals: stateRef.current.goals.map((g) => (g.id === id ? saved : g)),
      });
      if (patch.savedMinor !== undefined) {
        const evalResult = await apiFetch<{ goal: ApiGoal }>(
          `/spaces/${existing.spaceId}/goals/${id}/evaluate`,
          { method: 'POST', body: JSON.stringify({}) },
        );
        if (!evalResult.offline && evalResult.data?.goal) {
          saved = mapGoal(evalResult.data.goal);
          commit({
            ...stateRef.current,
            goals: stateRef.current.goals.map((g) => (g.id === id ? saved : g)),
          });
        }
      }
    },
    [commit],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (offlineRef.current) throw new ApiError('Sign in to delete goals', 401);
      const existing = stateRef.current.goals.find((g) => g.id === id);
      if (!existing) return;
      commit({
        ...stateRef.current,
        goals: stateRef.current.goals.filter((g) => g.id !== id),
      });
      await apiFetch(`/spaces/${existing.spaceId}/goals/${id}`, { method: 'DELETE' }).catch(
        () => undefined,
      );
    },
    [commit],
  );

  const createRecurring = useCallback(
    async (input: {
      name: string;
      amountMinor: number;
      kind: 'income' | 'expense';
      dayOfMonth: number;
    }) => {
      if (offlineRef.current) throw new ApiError('Sign in to manage recurring items', 401);
      const spaceId = stateRef.current.activeSpaceId;
      const space = stateRef.current.spaces.find((s) => s.id === spaceId);
      if (!space) throw new ApiError('Space not found', 404);
      const result = await apiFetch<ApiRecurring>(`/spaces/${spaceId}/recurring`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name.trim(),
          amountMinor: input.amountMinor,
          kind: input.kind,
          dayOfMonth: input.dayOfMonth,
          currency: space.currency,
        }),
      });
      if (result.offline || !result.data) throw new ApiError('API is offline', 503);
      const created = mapRecurring(result.data);
      commit({
        ...stateRef.current,
        recurring: [...stateRef.current.recurring.filter((r) => r.id !== created.id), created],
      });
      return created;
    },
    [commit],
  );

  const updateRecurring = useCallback(
    async (
      id: string,
      patch: {
        name?: string;
        amountMinor?: number;
        kind?: 'income' | 'expense';
        dayOfMonth?: number;
        active?: boolean;
      },
    ) => {
      if (offlineRef.current) throw new ApiError('Sign in to manage recurring items', 401);
      const existing = stateRef.current.recurring.find((r) => r.id === id);
      if (!existing) throw new ApiError('Not found', 404);
      commit({
        ...stateRef.current,
        recurring: stateRef.current.recurring.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      });
      const result = await apiFetch<ApiRecurring>(
        `/spaces/${existing.spaceId}/recurring/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        },
      );
      if (result.offline || !result.data) return;
      const saved = mapRecurring(result.data);
      commit({
        ...stateRef.current,
        recurring: stateRef.current.recurring.map((r) => (r.id === id ? saved : r)),
      });
    },
    [commit],
  );

  const deleteRecurring = useCallback(
    async (id: string) => {
      if (offlineRef.current) throw new ApiError('Sign in to manage recurring items', 401);
      const existing = stateRef.current.recurring.find((r) => r.id === id);
      if (!existing) return;
      commit({
        ...stateRef.current,
        recurring: stateRef.current.recurring.filter((r) => r.id !== id),
      });
      await apiFetch(`/spaces/${existing.spaceId}/recurring/${id}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    },
    [commit],
  );

  const value = useMemo(
    () => ({
      state,
      offline,
      ready,
      signedIn: Boolean(sessionUser) && !offline,
      sessionUser,
      showLoginPrompt,
      dismissLoginPrompt,
      refresh,
      setSpace,
      createSpace,
      updateSpace,
      createGoal,
      evaluateGoal,
      updateGoal,
      deleteGoal,
      createRecurring,
      updateRecurring,
      deleteRecurring,
      addTransaction,
      updateTransaction,
      undoTransaction,
      restoreTransaction,
      hideTransaction,
      unhideTransaction,
      addCategory,
      renameCategory,
      deleteCategory,
    }),
    [
      state,
      offline,
      ready,
      sessionUser,
      showLoginPrompt,
      dismissLoginPrompt,
      refresh,
      setSpace,
      createSpace,
      updateSpace,
      createGoal,
      evaluateGoal,
      updateGoal,
      deleteGoal,
      createRecurring,
      updateRecurring,
      deleteRecurring,
      addTransaction,
      updateTransaction,
      undoTransaction,
      restoreTransaction,
      hideTransaction,
      unhideTransaction,
      addCategory,
      renameCategory,
      deleteCategory,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
}
