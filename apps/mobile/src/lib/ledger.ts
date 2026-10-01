import type { Goal, LedgerTransaction, SpaceRole } from '@clear-money/domain';
import { defaultCategoryRows } from '@clear-money/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';
import { getPersonalSpaceId, setPersonalSpaceId } from './session';
import { loadSetupSession } from './setup-session';

const CACHE_KEY = 'cm.mobile.ledger.v1';
const ACTIVE_SPACE_KEY = 'cm.mobile.activeSpaceId';

export type MobileCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  spaceId?: string | null;
  stableKey?: string | null;
};

export type MobileSpace = {
  id: string;
  name: string;
  currency: string;
  role: SpaceRole;
  type?: string;
};

export type MobileRecurring = {
  id: string;
  spaceId: string;
  name: string;
  amountMinor: number;
  currency: string;
  kind: 'income' | 'expense';
  dayOfMonth: number;
  nextDueAt: string | null;
  active: boolean;
  notifyHoursBefore: number;
};

export type MobileLedger = {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  plan?: string | null;
  activeSpaceId: string;
  spaces: MobileSpace[];
  categories: MobileCategory[];
  transactions: LedgerTransaction[];
  goals: Goal[];
  recurring: MobileRecurring[];
  offline: boolean;
  fetchedAt: string;
};

type ApiMe = {
  id: string;
  name?: string | null;
  email?: string | null;
  plan?: string | null;
  defaultCurrency?: string | null;
  setupSession?: { completed?: boolean; needsPersonalSpace?: boolean } | null;
} | null;

type ApiSpace = {
  id: string;
  name: string;
  currency: string;
  role: SpaceRole;
  type?: string;
};

type ApiCategory = {
  id: string;
  name: string;
  type: string;
  spaceId?: string | null;
  stableKey?: string | null;
};

type ApiTxn = {
  id: string;
  spaceId: string;
  type: string;
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  occurredAt: string;
  createdAt?: string;
  createdBy: string;
  source: string;
  status: string;
};

function toIso(value: string | Date | undefined | null): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function mapTxn(row: ApiTxn): LedgerTransaction | null {
  if (row.type !== 'income' && row.type !== 'expense') return null;
  return {
    id: row.id,
    spaceId: row.spaceId,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    categoryId: row.categoryId,
    description: row.description,
    occurredAt: toIso(row.occurredAt),
    createdAt: toIso(row.createdAt ?? row.occurredAt),
    createdBy: row.createdBy,
    source: (row.source as LedgerTransaction['source']) || 'manual',
    status: (row.status as LedgerTransaction['status']) || 'confirmed',
  };
}

async function readJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getActiveSpaceId(): Promise<string | null> {
  return (
    (await AsyncStorage.getItem(ACTIVE_SPACE_KEY)) ||
    (await getPersonalSpaceId())
  );
}

export async function setActiveSpaceId(spaceId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_SPACE_KEY, spaceId);
  await setPersonalSpaceId(spaceId);
}

export async function loadCachedLedger(): Promise<MobileLedger | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileLedger;
  } catch {
    return null;
  }
}

async function saveCachedLedger(ledger: MobileLedger): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(ledger));
}

export async function clearCachedLedger(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Persist a transaction into the local guest ledger (offline / skip-account). */
export async function appendGuestTransaction(input: {
  type: 'income' | 'expense';
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  occurredAt?: string;
}): Promise<MobileLedger> {
  const ledger = await emptyGuestLedger();
  const now = new Date().toISOString();
  const row: LedgerTransaction = {
    id: `guest_txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    spaceId: ledger.activeSpaceId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    categoryId: input.categoryId,
    description: input.description,
    occurredAt: input.occurredAt ?? now,
    createdAt: now,
    createdBy: 'guest',
    source: 'manual',
    status: 'confirmed',
  };
  const next: MobileLedger = {
    ...ledger,
    transactions: [row, ...ledger.transactions],
    fetchedAt: now,
  };
  await saveCachedLedger(next);
  return next;
}

export async function emptyGuestLedger(): Promise<MobileLedger> {
  const setup = await loadSetupSession();
  const currency = setup.currency || 'USD';
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest' && cached.spaces.length) {
    const defaults = defaultCategoryRows().map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      spaceId: null as string | null,
      stableKey: c.stableKey,
    }));
    const have = new Set(cached.categories.map((c) => c.stableKey ?? c.id));
    const missing = defaults.filter((d) => !have.has(d.stableKey) && !have.has(d.id));
    if (!missing.length) return { ...cached, offline: true };
    const next = { ...cached, categories: [...missing, ...cached.categories], offline: true };
    await saveCachedLedger(next);
    return next;
  }
  const id = `guest_space_${currency}`;
  const ledger: MobileLedger = {
    userId: 'guest',
    userName: null,
    userEmail: null,
    plan: 'free',
    activeSpaceId: id,
    spaces: [{ id, name: 'Personal', currency, role: 'owner', type: 'personal' }],
    categories: defaultCategoryRows().map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      spaceId: null,
      stableKey: c.stableKey,
    })),
    transactions: [],
    goals: [],
    recurring: [],
    offline: true,
    fetchedAt: new Date().toISOString(),
  };
  await saveCachedLedger(ledger);
  await setPersonalSpaceId(id);
  return ledger;
}

/** Pull spaces / transactions / goals / recurring / categories from the live API. */
export async function hydrateLedger(): Promise<MobileLedger> {
  const setup = await loadSetupSession();
  const meRes = await apiFetch('/me');
  if (meRes.status === 401) {
    return emptyGuestLedger();
  }
  const me = await readJson<ApiMe>(meRes);
  if (!me?.id) {
    const cached = await loadCachedLedger();
    if (cached) return { ...cached, offline: true };
    throw new Error('Could not load account');
  }

  if (me.setupSession?.needsPersonalSpace) {
    await apiFetch('/me/setup-complete', {
      method: 'POST',
      body: JSON.stringify({
        locale: setup.language,
        defaultCurrency: setup.currency,
        notificationEnabled: setup.notificationsEnabled,
      }),
    }).catch(() => undefined);
    await apiFetch('/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan: 'free' }),
    }).catch(() => undefined);
  }

  let spacesRes = await apiFetch('/spaces');
  let spaces = (await readJson<ApiSpace[]>(spacesRes)) ?? [];
  if (!spaces.length) {
    await apiFetch('/me/setup-complete', {
      method: 'POST',
      body: JSON.stringify({
        locale: setup.language,
        defaultCurrency: setup.currency,
        notificationEnabled: setup.notificationsEnabled,
      }),
    }).catch(() => undefined);
    spacesRes = await apiFetch('/spaces');
    spaces = (await readJson<ApiSpace[]>(spacesRes)) ?? [];
  }

  const mappedSpaces: MobileSpace[] = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    currency: s.currency,
    role: s.role,
    type: s.type,
  }));

  const preferred = await getActiveSpaceId();
  const activeSpaceId =
    (preferred && mappedSpaces.some((s) => s.id === preferred) ? preferred : null) ??
    mappedSpaces[0]?.id ??
    '';

  if (activeSpaceId) {
    await setActiveSpaceId(activeSpaceId);
  }

  const categoriesRes = await apiFetch('/categories');
  const categoriesRaw = (await readJson<ApiCategory[]>(categoriesRes)) ?? [];
  const categories: MobileCategory[] = categoriesRaw
    .filter((c): c is ApiCategory & { type: 'income' | 'expense' } =>
      c.type === 'income' || c.type === 'expense',
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      spaceId: c.spaceId ?? null,
      stableKey: c.stableKey ?? null,
    }));

  const transactions: LedgerTransaction[] = [];
  const goals: Goal[] = [];
  const recurring: MobileRecurring[] = [];

  await Promise.all(
    mappedSpaces.map(async (space) => {
      const [txnsRes, goalsRes, recurringRes] = await Promise.all([
        apiFetch(`/spaces/${space.id}/transactions`),
        apiFetch(`/spaces/${space.id}/goals`),
        apiFetch(`/spaces/${space.id}/recurring`),
      ]);
      const txns = (await readJson<ApiTxn[]>(txnsRes)) ?? [];
      const goalsRows = (await readJson<Goal[]>(goalsRes)) ?? [];
      const recurringRows = (await readJson<MobileRecurring[]>(recurringRes)) ?? [];
      for (const row of txns) {
        const mapped = mapTxn(row);
        if (mapped) transactions.push(mapped);
      }
      for (const g of goalsRows) goals.push(g);
      for (const r of recurringRows) recurring.push(r);
    }),
  );

  transactions.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const ledger: MobileLedger = {
    userId: me.id,
    userName: me.name ?? null,
    userEmail: me.email ?? null,
    plan: me.plan ?? 'free',
    activeSpaceId,
    spaces: mappedSpaces,
    categories,
    transactions,
    goals,
    recurring,
    offline: false,
    fetchedAt: new Date().toISOString(),
  };
  await saveCachedLedger(ledger);
  return ledger;
}

export async function createRecurring(input: {
  spaceId: string;
  name: string;
  amountMinor: number;
  kind: 'income' | 'expense';
  dayOfMonth: number;
}): Promise<MobileRecurring> {
  const res = await apiFetch(`/spaces/${input.spaceId}/recurring`, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      amountMinor: input.amountMinor,
      kind: input.kind,
      dayOfMonth: input.dayOfMonth,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Could not create recurring (${res.status})`);
  }
  return (await res.json()) as MobileRecurring;
}

export async function updateRecurring(
  spaceId: string,
  id: string,
  patch: {
    name?: string;
    amountMinor?: number;
    kind?: 'income' | 'expense';
    dayOfMonth?: number;
    active?: boolean;
  },
): Promise<MobileRecurring> {
  const res = await apiFetch(`/spaces/${spaceId}/recurring/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Could not update recurring (${res.status})`);
  }
  return (await res.json()) as MobileRecurring;
}

export async function deleteRecurring(spaceId: string, id: string): Promise<void> {
  const res = await apiFetch(`/spaces/${spaceId}/recurring/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Could not delete recurring (${res.status})`);
  }
}

/** Prefer network; fall back to cache when offline. */
export async function loadLedger(): Promise<MobileLedger> {
  try {
    return await hydrateLedger();
  } catch (err) {
    const cached = await loadCachedLedger();
    if (cached) return { ...cached, offline: true };
    throw err;
  }
}

export function transactionsForSpace(
  ledger: MobileLedger,
  spaceId?: string,
): LedgerTransaction[] {
  const id = spaceId || ledger.activeSpaceId;
  return ledger.transactions.filter((t) => t.spaceId === id);
}

export function visibleTransactionsForSpace(
  ledger: MobileLedger,
  hiddenIds: string[],
  spaceId?: string,
): LedgerTransaction[] {
  const hidden = new Set(hiddenIds);
  return transactionsForSpace(ledger, spaceId).filter(
    (t) => t.type !== 'transfer' && !hidden.has(t.id),
  );
}

async function readError(res: Response): Promise<string> {
  const msg = await res.text().catch(() => '');
  try {
    const json = JSON.parse(msg) as { error?: string; message?: string };
    return json.error || json.message || msg || `Request failed (${res.status})`;
  } catch {
    return msg || `Request failed (${res.status})`;
  }
}

export async function deleteTransaction(spaceId: string, id: string): Promise<void> {
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    const next = {
      ...cached,
      transactions: cached.transactions.filter((t) => t.id !== id),
    };
    await saveCachedLedger(next);
    return;
  }
  const res = await apiFetch(`/spaces/${spaceId}/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}

export async function updateTransaction(
  spaceId: string,
  id: string,
  patch: {
    description?: string | null;
    categoryId?: string | null;
    amountMinor?: number;
    occurredAt?: string;
  },
): Promise<void> {
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    await saveCachedLedger({
      ...cached,
      transactions: cached.transactions.map((t) =>
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
    return;
  }
  const res = await apiFetch(`/spaces/${spaceId}/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function createCategory(input: {
  name: string;
  type: 'income' | 'expense';
  spaceId?: string;
}): Promise<MobileCategory> {
  const spaceId = input.spaceId || (await getActiveSpaceId());
  if (!spaceId) throw new Error('No active space');
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    const row: MobileCategory = {
      id: `guest_cat_${Date.now()}`,
      name: input.name.trim(),
      type: input.type,
      spaceId,
      stableKey: null,
    };
    const next = { ...cached, categories: [...cached.categories, row] };
    await saveCachedLedger(next);
    return row;
  }
  const res = await apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify({ name: input.name.trim(), type: input.type, spaceId }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const created = (await res.json()) as MobileCategory;
  if (cached) {
    await saveCachedLedger({
      ...cached,
      categories: [...cached.categories, created],
    });
  }
  return created;
}

export async function renameCategory(id: string, name: string): Promise<MobileCategory> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name required');
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    const next = {
      ...cached,
      categories: cached.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
    };
    await saveCachedLedger(next);
    const cat = next.categories.find((c) => c.id === id);
    if (!cat) throw new Error('Category not found');
    return cat;
  }
  const res = await apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: trimmed }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as MobileCategory;
}

export async function deleteCategory(id: string): Promise<void> {
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    await saveCachedLedger({
      ...cached,
      categories: cached.categories.filter((c) => c.id !== id),
      transactions: cached.transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: null } : t,
      ),
    });
    return;
  }
  const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}

export async function createTransaction(input: {
  spaceId: string;
  type: 'income' | 'expense';
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  occurredAt: string;
}): Promise<LedgerTransaction> {
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    const before = new Set(cached.transactions.map((t) => t.id));
    const next = await appendGuestTransaction({
      type: input.type,
      amountMinor: input.amountMinor,
      currency: input.currency,
      categoryId: input.categoryId,
      description: input.description,
      occurredAt: input.occurredAt,
    });
    const created = next.transactions.find((t) => !before.has(t.id));
    if (!created) throw new Error('Guest transaction failed');
    return created;
  }
  const { createIdempotencyKey } = await import('@clear-money/domain');
  const { offlineQueue } = await import('../offline/client');
  const local = await offlineQueue.enqueueLocal({
    spaceId: input.spaceId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    categoryId: input.categoryId,
    description: input.description,
    occurredAt: input.occurredAt,
    idempotencyKey: createIdempotencyKey(),
  });
  await offlineQueue.reconcile();
  return {
    id: local.id,
    spaceId: local.spaceId,
    type: local.type,
    amountMinor: local.amountMinor,
    currency: local.currency,
    categoryId: local.categoryId,
    description: local.description,
    occurredAt: local.occurredAt,
    createdAt: local.createdAt,
    createdBy: 'self',
    status: local.status === 'pending_sync' ? 'pending_sync' : 'confirmed',
    source: 'manual',
  };
}

export async function restoreTransaction(txn: LedgerTransaction): Promise<void> {
  const cached = await loadCachedLedger();
  if (cached?.userId === 'guest') {
    if (cached.transactions.some((t) => t.id === txn.id)) return;
    await saveCachedLedger({
      ...cached,
      transactions: [txn, ...cached.transactions],
    });
    return;
  }
  const res = await apiFetch(`/spaces/${txn.spaceId}/transactions`, {
    method: 'POST',
    body: JSON.stringify({
      type: txn.type,
      amountMinor: txn.amountMinor,
      currency: txn.currency,
      categoryId: txn.categoryId,
      description: txn.description,
      occurredAt: txn.occurredAt,
      source: txn.source,
      confirm: true,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function createSpace(input: {
  name: string;
  type: 'personal' | 'project' | 'family' | 'company';
  currency?: string;
}): Promise<MobileSpace> {
  const res = await apiFetch('/spaces', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      type: input.type,
      currency: input.currency,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const created = (await res.json()) as MobileSpace;
  await setActiveSpaceId(created.id);
  return created;
}

export async function updateSpace(
  spaceId: string,
  patch: { name?: string; currency?: string },
): Promise<void> {
  const res = await apiFetch(`/spaces/${spaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res));
  if (patch.currency) {
    await apiFetch('/me', {
      method: 'PATCH',
      body: JSON.stringify({ defaultCurrency: patch.currency }),
    }).catch(() => undefined);
  }
}

export async function createGoal(input: {
  spaceId: string;
  name: string;
  targetMinor: number;
  currency: string;
  durationMonths: number;
  startDate?: string;
}): Promise<Goal> {
  const startDate = input.startDate || new Date().toISOString().slice(0, 10);
  const res = await apiFetch(`/spaces/${input.spaceId}/goals`, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      targetMinor: input.targetMinor,
      currency: input.currency,
      durationMonths: input.durationMonths,
      startDate,
      plannedContributionMinor: Math.ceil(input.targetMinor / input.durationMonths),
      notificationPolicy: 'weekly',
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Goal;
}

export async function updateGoal(
  spaceId: string,
  goalId: string,
  patch: { savedMinor?: number; name?: string; status?: string },
): Promise<Goal> {
  const res = await apiFetch(`/spaces/${spaceId}/goals/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Goal;
}

export async function evaluateGoal(spaceId: string, goalId: string): Promise<void> {
  await apiFetch(`/spaces/${spaceId}/goals/${goalId}/evaluate`, {
    method: 'POST',
    body: '{}',
  }).catch(() => undefined);
}

export async function deleteGoal(spaceId: string, goalId: string): Promise<void> {
  const res = await apiFetch(`/spaces/${spaceId}/goals/${goalId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}

export async function inviteSpaceMember(
  spaceId: string,
  email: string,
  role: string,
): Promise<{ id: string; acceptPath: string }> {
  const res = await apiFetch(`/spaces/${spaceId}/members/invite`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { id: string; acceptPath: string };
}

export function goalsForSpace(ledger: MobileLedger, spaceId?: string): Goal[] {
  const id = spaceId || ledger.activeSpaceId;
  return ledger.goals.filter((g) => g.spaceId === id && g.status !== 'cancelled');
}

export function recurringForSpace(
  ledger: MobileLedger,
  spaceId?: string,
): MobileRecurring[] {
  const id = spaceId || ledger.activeSpaceId;
  return ledger.recurring.filter((r) => r.spaceId === id && r.active);
}

export function categoryName(
  ledger: MobileLedger,
  categoryId: string | null,
): string {
  if (!categoryId) return 'Uncategorized';
  return ledger.categories.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

/** Web host for Penny chat BFF (`/api/ai/chat`). */
export function getWebOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const api = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
  return api.replace(/\/cm-api\/?$/, '').replace(/\/$/, '') || 'https://moneymap.phronexus-ai.com';
}
