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
  createId,
  type Goal,
  type LedgerTransaction,
  type SpaceRole,
} from '@clear-money/domain';
import { apiFetch, ApiError } from '@/lib/api';
import { loadSetupSession } from '@/lib/setup-session';
import {
  addDemoCategory,
  addDemoTransaction,
  hideDemoTransaction,
  loadApiLedgerCache,
  loadDemoState,
  removeDemoTransaction,
  restoreDemoTransaction,
  saveApiLedgerCache,
  setActiveSpace as setDemoActiveSpace,
  unhideDemoTransaction,
  updateDemoTransaction,
  type DemoCategory,
  type DemoState,
} from '@/lib/demo-state';

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
    targetDate?: string;
    plannedContributionMinor?: number;
  }) => Promise<Goal>;
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
  addTransaction: (
    input: Omit<LedgerTransaction, 'id' | 'createdAt' | 'createdBy' | 'status' | 'source'> & {
      source?: LedgerTransaction['source'];
    },
  ) => LedgerTransaction;
  updateTransaction: (
    id: string,
    patch: { description?: string | null; categoryId?: string | null },
  ) => void;
  undoTransaction: (id: string) => void;
  restoreTransaction: (transaction: LedgerTransaction) => void;
  hideTransaction: (id: string) => void;
  unhideTransaction: (id: string) => void;
  addCategory: (input: { name: string; type: 'income' | 'expense' }) => DemoCategory;
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

function mapGoal(row: ApiGoal): Goal {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    targetMinor: row.targetMinor,
    savedMinor: row.savedMinor,
    currency: row.currency,
    targetDate: row.targetDate,
    plannedContributionMinor: row.plannedContributionMinor,
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
      const [txns, goals] = await Promise.all([
        apiFetch<ApiTxn[]>(`/spaces/${space.id}/transactions`),
        apiFetch<ApiGoal[]>(`/spaces/${space.id}/goals`),
      ]);
      return { spaceId: space.id, txns, goals };
    }),
  ]);

  const transactions: LedgerTransaction[] = [];
  const goals: Goal[] = [];
  if (!categoriesResult.offline) {
    for (const payload of spacePayloads) {
      if (payload.txns.offline || payload.goals.offline) continue;
      for (const row of payload.txns.data ?? []) {
        if (row.type === 'transfer') continue;
        transactions.push(mapTxn(row));
      }
      for (const row of payload.goals.data ?? []) {
        goals.push(mapGoal(row));
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
      hiddenIds: readHiddenIds(),
    },
  };
}

export function LedgerProvider({ children }: { children: ReactNode }) {
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
    if (opts?.persistCache || !offlineRef.current) {
      saveApiLedgerCache(next);
    }
  }, []);

  const applyDemo = useCallback(() => {
    setSessionUser(null);
    const cached = loadApiLedgerCache();
    if (cached?.spaces?.length) {
      commit(cached, { persistCache: true });
      setOffline(true);
      offlineRef.current = true;
      return;
    }
    const demo = loadDemoState();
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
        } catch {
          // Keep optimistic row; user can refresh
        }
      })();

      return optimistic;
    },
    [applyDemo, commit, noteUnsignedWrite],
  );

  const updateTransaction = useCallback(
    (id: string, patch: { description?: string | null; categoryId?: string | null }) => {
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
              }
            : t,
        ),
      });
      if (!existing) return;
      void apiFetch(`/spaces/${existing.spaceId}/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).catch(() => undefined);
    },
    [commit],
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
      }).catch(() => undefined);
    },
    [commit],
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
        const result = addDemoCategory(stateRef.current, input);
        commit(result.state);
        return result.category;
      }
      const optimistic: DemoCategory = {
        id: createId('cat'),
        name: input.name.trim(),
        type: input.type,
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

  const createGoal = useCallback(
    async (input: {
      name: string;
      targetMinor: number;
      currency: string;
      targetDate?: string;
      plannedContributionMinor?: number;
    }) => {
      if (offlineRef.current) throw new ApiError('Sign in to create goals', 401);
      const spaceId = stateRef.current.activeSpaceId;
      const targetDate =
        input.targetDate ??
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const result = await apiFetch<Goal & { id: string }>(`/spaces/${spaceId}/goals`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name.trim(),
          targetMinor: input.targetMinor,
          currency: input.currency,
          targetDate,
          plannedContributionMinor: input.plannedContributionMinor ?? 0,
        }),
      });
      if (result.offline || !result.data) throw new ApiError('API is offline', 503);
      const created: Goal = {
        id: result.data.id,
        spaceId,
        name: input.name.trim(),
        targetMinor: input.targetMinor,
        savedMinor: 0,
        currency: input.currency,
        targetDate,
        plannedContributionMinor: input.plannedContributionMinor ?? 0,
        notificationPolicy: 'weekly',
        status: 'active',
      };
      const serverGoal = mapGoal({
        ...created,
        ...result.data,
        spaceId,
      } as ApiGoal);
      commit({
        ...stateRef.current,
        goals: [...stateRef.current.goals.filter((g) => g.id !== serverGoal.id), serverGoal],
      });
      return serverGoal;
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
      const saved = mapGoal(result.data);
      commit({
        ...stateRef.current,
        goals: stateRef.current.goals.map((g) => (g.id === id ? saved : g)),
      });
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
      updateGoal,
      deleteGoal,
      addTransaction,
      updateTransaction,
      undoTransaction,
      restoreTransaction,
      hideTransaction,
      unhideTransaction,
      addCategory,
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
      updateGoal,
      deleteGoal,
      addTransaction,
      updateTransaction,
      undoTransaction,
      restoreTransaction,
      hideTransaction,
      unhideTransaction,
      addCategory,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
}
