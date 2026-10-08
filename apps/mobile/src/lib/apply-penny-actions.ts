/**
 * Apply Penny chat `actions` to the mobile ledger (parity with web AiChat).
 */
import {
  currencyDecimalPlaces,
  matchDefaultCategoryHint,
  parseDisplayAmount,
  stripCategoryEmoji,
  type CurrencyCode,
} from '@clear-money/domain';
import { hideTxnId } from './hidden-txns';
import {
  createCategory,
  createGoal,
  createRecurring,
  createSpace,
  createTransaction,
  deleteCategory,
  deleteGoal,
  deleteRecurring,
  deleteTransaction,
  inviteSpaceMember,
  renameCategory,
  setActiveSpaceId,
  updateGoal,
  updateRecurring,
  updateTransaction,
  type MobileCategory,
  type MobileLedger,
} from './ledger';

export type PennyAction =
  | { type: 'create_category'; name: string; categoryType: 'income' | 'expense' }
  | {
      type: 'rename_category';
      categoryId?: string;
      fromName?: string;
      toName: string;
      categoryType?: 'income' | 'expense';
    }
  | {
      type: 'delete_category';
      categoryId?: string;
      name?: string;
      categoryType?: 'income' | 'expense';
    }
  | {
      type: 'add_transaction';
      entryType: 'income' | 'expense';
      amountMajor: number;
      category?: string;
      note?: string;
      occurredAt?: string;
    }
  | {
      type: 'ask_category';
      entryType: 'income' | 'expense';
      amountMajor: number;
      occurredAt?: string;
      suggestions: Array<{ label: string; value: string; icon: string }>;
      note?: string;
    }
  | {
      type: 'update_transaction';
      transactionId: string;
      note?: string;
      category?: string;
      amountMajor?: number;
      occurredAt?: string;
    }
  | { type: 'delete_transaction'; transactionId: string }
  | { type: 'hide_transaction'; transactionId: string }
  | {
      type: 'create_goal';
      name: string;
      targetMajor: number;
      durationMonths: number;
      startDate?: string;
    }
  | {
      type: 'update_goal';
      goalId: string;
      name?: string;
      savedMajor?: number;
      status?: string;
    }
  | { type: 'delete_goal'; goalId: string }
  | {
      type: 'create_recurring';
      name: string;
      amountMajor: number;
      kind: 'income' | 'expense';
      dayOfMonth: number;
    }
  | {
      type: 'update_recurring';
      recurringId: string;
      name?: string;
      amountMajor?: number;
      kind?: 'income' | 'expense';
      dayOfMonth?: number;
      active?: boolean;
    }
  | { type: 'delete_recurring'; recurringId: string }
  | {
      type: 'create_space';
      name: string;
      spaceType: 'personal' | 'project' | 'family' | 'company';
      currency?: string;
    }
  | { type: 'switch_space'; spaceId?: string; spaceName?: string }
  | {
      type: 'invite_member';
      email: string;
      role: 'viewer' | 'contributor' | 'admin' | 'child';
    }
  | { type: 'report'; title: string; body: string }
  | { type: string; [key: string]: unknown };

function majorToMinor(amountMajor: number, currency: string): number | null {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) return null;
  try {
    const decimals = currencyDecimalPlaces(currency as CurrencyCode);
    return parseDisplayAmount(amountMajor.toFixed(decimals), currency as CurrencyCode);
  } catch {
    return null;
  }
}

export async function applyPennyActions(
  actions: PennyAction[],
  ledger: MobileLedger,
): Promise<{
  applied: number;
  pendingAsk: PennyAction | null;
  reports: Array<{ title: string; body: string }>;
}> {
  let categories: MobileCategory[] = [...ledger.categories];
  const spaceId = ledger.activeSpaceId;
  const currency =
    ledger.spaces.find((s) => s.id === spaceId)?.currency ?? 'USD';
  let applied = 0;
  let pendingAsk: PennyAction | null = null;
  const reports: Array<{ title: string; body: string }> = [];

  const resolveCat = (
    name: string | undefined,
    type: 'income' | 'expense',
    opts?: { mapDefaults?: boolean },
  ) => {
    if (!name) return null;
    const mapped =
      opts?.mapDefaults === false
        ? stripCategoryEmoji(name)
        : matchDefaultCategoryHint(name, type) ?? stripCategoryEmoji(name);
    const needle = (mapped || name).toLowerCase();
    return (
      categories.find((c) => {
        if (c.type !== type) return false;
        if (c.spaceId != null && c.spaceId !== spaceId) return false;
        const cleaned = stripCategoryEmoji(c.name).toLowerCase();
        return (
          c.name.toLowerCase() === needle ||
          cleaned === needle ||
          cleaned === name.toLowerCase()
        );
      })?.id ?? null
    );
  };

  const ensureCat = async (
    name: string,
    type: 'income' | 'expense',
    opts?: { mapDefaults?: boolean },
  ) => {
    const mapDefaults = opts?.mapDefaults !== false;
    const mapped = mapDefaults
      ? matchDefaultCategoryHint(name, type) ?? stripCategoryEmoji(name) ?? name
      : stripCategoryEmoji(name) || name;
    let id = resolveCat(mapped, type, { mapDefaults }) ?? resolveCat(name, type, { mapDefaults });
    if (id) return id;
    const created = await createCategory({ name: mapped, type, spaceId });
    categories = [...categories, created];
    applied += 1;
    return created.id;
  };

  for (const action of actions) {
    try {
      if (action.type === 'ask_category') {
        pendingAsk = action;
        continue;
      }
      if (action.type === 'report') {
        reports.push({ title: String(action.title), body: String(action.body) });
        continue;
      }
      if (action.type === 'create_category') {
        await ensureCat(String(action.name), action.categoryType as 'income' | 'expense', {
          mapDefaults: false,
        });
        continue;
      }
      if (action.type === 'rename_category') {
        let id = action.categoryId ? String(action.categoryId) : undefined;
        if (!id && action.fromName) {
          const type = action.categoryType as 'income' | 'expense' | undefined;
          const match = categories.find(
            (c) =>
              c.name.toLowerCase() === String(action.fromName).toLowerCase() &&
              (!type || c.type === type),
          );
          id = match?.id;
        }
        if (id) {
          const updated = await renameCategory(id, String(action.toName));
          categories = categories.map((c) => (c.id === id ? updated : c));
          applied += 1;
        }
        continue;
      }
      if (action.type === 'delete_category') {
        let id = action.categoryId ? String(action.categoryId) : undefined;
        if (!id && action.name) {
          const type = action.categoryType as 'income' | 'expense' | undefined;
          const match = categories.find(
            (c) =>
              c.name.toLowerCase() === String(action.name).toLowerCase() &&
              (!type || c.type === type),
          );
          id = match?.id;
        }
        if (id) {
          await deleteCategory(id);
          categories = categories.filter((c) => c.id !== id);
          applied += 1;
        }
        continue;
      }
      if (action.type === 'add_transaction') {
        const amountMinor = majorToMinor(Number(action.amountMajor), currency);
        if (amountMinor == null) continue;
        const entryType = action.entryType as 'income' | 'expense';
        const category = action.category ? String(action.category) : undefined;
        if (!category) {
          pendingAsk = action;
          continue;
        }
        const categoryId = await ensureCat(category, entryType);
        await createTransaction({
          spaceId,
          type: entryType,
          amountMinor,
          currency,
          categoryId,
          description: action.note ? String(action.note) : null,
          occurredAt: action.occurredAt
            ? new Date(String(action.occurredAt)).toISOString()
            : new Date().toISOString(),
        });
        applied += 1;
        continue;
      }
      if (action.type === 'update_transaction') {
        let categoryId: string | null | undefined;
        if (action.category) {
          categoryId = await ensureCat(String(action.category), 'expense');
        }
        const amountMinor =
          action.amountMajor != null
            ? majorToMinor(Number(action.amountMajor), currency)
            : undefined;
        await updateTransaction(spaceId, String(action.transactionId), {
          description: action.note !== undefined ? String(action.note) : undefined,
          categoryId,
          amountMinor: amountMinor ?? undefined,
          occurredAt: action.occurredAt
            ? new Date(String(action.occurredAt)).toISOString()
            : undefined,
        });
        applied += 1;
        continue;
      }
      if (action.type === 'delete_transaction') {
        await deleteTransaction(spaceId, String(action.transactionId));
        applied += 1;
        continue;
      }
      if (action.type === 'hide_transaction') {
        await hideTxnId(String(action.transactionId));
        applied += 1;
        continue;
      }
      if (action.type === 'create_goal') {
        const targetMinor = majorToMinor(Number(action.targetMajor), currency);
        if (targetMinor == null) continue;
        await createGoal({
          spaceId,
          name: String(action.name),
          targetMinor,
          currency,
          durationMonths: Math.max(1, Math.floor(Number(action.durationMonths) || 1)),
          startDate: action.startDate ? String(action.startDate) : undefined,
        });
        applied += 1;
        continue;
      }
      if (action.type === 'update_goal') {
        const savedMinor =
          action.savedMajor != null
            ? majorToMinor(Number(action.savedMajor), currency)
            : undefined;
        await updateGoal(spaceId, String(action.goalId), {
          name: action.name ? String(action.name) : undefined,
          savedMinor: savedMinor ?? undefined,
          status: action.status ? String(action.status) : undefined,
        });
        applied += 1;
        continue;
      }
      if (action.type === 'delete_goal') {
        await deleteGoal(spaceId, String(action.goalId));
        applied += 1;
        continue;
      }
      if (action.type === 'create_recurring') {
        const amountMinor = majorToMinor(Number(action.amountMajor), currency);
        if (amountMinor == null) continue;
        await createRecurring({
          spaceId,
          name: String(action.name),
          amountMinor,
          kind: action.kind as 'income' | 'expense',
          dayOfMonth: Number(action.dayOfMonth) || 1,
        });
        applied += 1;
        continue;
      }
      if (action.type === 'update_recurring') {
        const amountMinor =
          action.amountMajor != null
            ? majorToMinor(Number(action.amountMajor), currency)
            : undefined;
        await updateRecurring(spaceId, String(action.recurringId), {
          name: action.name ? String(action.name) : undefined,
          amountMinor: amountMinor ?? undefined,
          kind: action.kind as 'income' | 'expense' | undefined,
          dayOfMonth: action.dayOfMonth != null ? Number(action.dayOfMonth) : undefined,
          active: typeof action.active === 'boolean' ? action.active : undefined,
        });
        applied += 1;
        continue;
      }
      if (action.type === 'delete_recurring') {
        await deleteRecurring(spaceId, String(action.recurringId));
        applied += 1;
        continue;
      }
      if (action.type === 'create_space') {
        await createSpace({
          name: String(action.name),
          type: action.spaceType as 'personal' | 'project' | 'family' | 'company',
          currency: action.currency ? String(action.currency) : currency,
        });
        applied += 1;
        continue;
      }
      if (action.type === 'switch_space') {
        let target = action.spaceId ? String(action.spaceId) : undefined;
        if (!target && action.spaceName) {
          const q = String(action.spaceName).toLowerCase();
          target = ledger.spaces.find((s) => s.name.toLowerCase().includes(q))?.id;
        }
        if (target) {
          await setActiveSpaceId(target);
          applied += 1;
        }
        continue;
      }
      if (action.type === 'invite_member') {
        await inviteSpaceMember(spaceId, String(action.role || 'contributor'));
        applied += 1;
      }
    } catch (err) {
      console.warn('[penny] action failed', action.type, err);
    }
  }

  return { applied, pendingAsk, reports };
}
