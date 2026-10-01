import {
  addMonthsToIsoDate,
  currencyDecimalPlaces,
  monthlyTargetMinor,
  parseDisplayAmount,
  type CurrencyCode,
} from '@clear-money/domain';
import type { AiAction, AiLedgerContext, AiSuggestion } from './types';

const EXPENSE_DEFAULTS: AiSuggestion[] = [
  { label: 'Food', value: 'Food', icon: 'utensils' },
  { label: 'Coffee', value: 'Coffee', icon: 'coffee' },
  { label: 'Clothes', value: 'Clothes', icon: 'shopping-bag' },
  { label: 'Transport', value: 'Transport', icon: 'car' },
  { label: 'Rent', value: 'Rent', icon: 'home' },
  { label: 'Shopping', value: 'Shopping', icon: 'shopping-bag' },
  { label: 'Fun', value: 'Entertainment', icon: 'party-popper' },
  { label: 'Health', value: 'Health', icon: 'heart' },
  { label: 'Other', value: 'Other', icon: 'circle-dot' },
];

const INCOME_DEFAULTS: AiSuggestion[] = [
  { label: 'Salary', value: 'Salary', icon: 'briefcase' },
  { label: 'Freelance', value: 'Freelance', icon: 'laptop' },
  { label: 'Bonus', value: 'Bonus', icon: 'gift' },
  { label: 'Gift', value: 'Gift', icon: 'sparkles' },
  { label: 'Other', value: 'Other', icon: 'circle-dot' },
];

const ICON_BY_NAME: Record<string, string> = {
  food: 'utensils',
  groceries: 'utensils',
  coffee: 'coffee',
  clothes: 'shopping-bag',
  clothing: 'shopping-bag',
  transport: 'car',
  transit: 'car',
  rent: 'home',
  housing: 'home',
  shopping: 'shopping-bag',
  entertainment: 'party-popper',
  fun: 'party-popper',
  health: 'heart',
  salary: 'briefcase',
  freelance: 'laptop',
  bonus: 'gift',
  gift: 'gift',
  subscriptions: 'repeat',
  other: 'circle-dot',
};

export function iconForCategory(name: string): string {
  return ICON_BY_NAME[name.trim().toLowerCase()] ?? 'tag';
}

export function buildCategorySuggestions(
  context: AiLedgerContext,
  entryType: 'income' | 'expense',
  extraHints: string[] = [],
): AiSuggestion[] {
  const defaults = entryType === 'income' ? INCOME_DEFAULTS : EXPENSE_DEFAULTS;
  const fromLedger = context.categories
    .filter((c) => c.type === entryType)
    .map((c) => ({
      label: c.name,
      value: c.name,
      icon: iconForCategory(c.name),
    }));

  const fromHints = extraHints
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => ({
      label: h,
      value: h,
      icon: iconForCategory(h),
    }));

  const merged = [...fromHints, ...fromLedger, ...defaults];
  const seen = new Set<string>();
  const unique: AiSuggestion[] = [];
  for (const item of merged) {
    const key = item.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 8) break;
  }
  return unique;
}

export const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'ask_for_category',
      description:
        'REQUIRED when the user gives an amount but no category. Surfaces category chips in the UI. Never ask for category in plain text without calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount in the space currency (major units)' },
          type: { type: 'string', enum: ['expense', 'income'] },
          when: { type: 'string', description: 'ISO datetime when it happened' },
          hints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional category guesses to surface first',
          },
          note: {
            type: 'string',
            description: 'Optional draft note to keep (e.g. original foreign amount)',
          },
        },
        required: ['amount', 'type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'convert_currency',
      description:
        'Look up a live FX rate and convert an amount into the space currency. ONLY use when the user mentions a currency code that differs from the active space currency. Never convert when the amount is already in the space currency.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount in the source currency' },
          from: { type: 'string', description: 'ISO currency code, e.g. TND' },
          to: {
            type: 'string',
            description: 'Target ISO currency. Defaults to the active space currency.',
          },
        },
        required: ['amount', 'from'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_entries',
      description: 'Search recent ledger entries by note, category, amount, or type so you can update them.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to match in note or category' },
          amount: { type: 'number', description: 'Major-unit amount to match approximately' },
          type: { type: 'string', enum: ['expense', 'income'] },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_entry',
      description:
        'Update a past entry: note, category, amount, and/or date. Prefer transactionId from find_entries or recent context. Can also match the latest similar entry.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          query: { type: 'string', description: 'Fallback search text if id unknown' },
          matchAmount: { type: 'number', description: 'Fallback major-unit amount match' },
          newNote: { type: 'string', description: 'Replacement note/description' },
          newCategory: { type: 'string', description: 'Replacement category name' },
          newAmount: { type: 'number', description: 'Replacement amount in space currency major units' },
          newWhen: { type: 'string', description: 'Replacement ISO datetime' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_entry',
      description:
        'Permanently delete a ledger entry. Prefer transactionId from find_entries or recent. Use when the user asks to remove/undo/delete a transaction.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          query: { type: 'string' },
          matchAmount: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'hide_entry',
      description:
        'Hide an entry from Home/Activity lists without deleting it (soft hide). Prefer transactionId when known.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          query: { type: 'string' },
          matchAmount: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_expense',
      description:
        'Record an expense only when the category is already known from the user. If category is missing, use ask_for_category instead. Amount must already be in space currency (convert first if needed).',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount in space currency major units' },
          category: { type: 'string', description: 'Expense category name' },
          note: { type: 'string', description: 'Short note or merchant' },
          when: { type: 'string', description: 'ISO datetime when it happened; default now' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_income',
      description:
        'Record income only when the category is already known. If category is missing, use ask_for_category instead. Convert foreign currency first.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount in space currency major units' },
          category: { type: 'string', description: 'Income category name' },
          note: { type: 'string' },
          when: { type: 'string', description: 'ISO datetime when it happened; default now' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_category',
      description: 'Create a spending or income category.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['expense', 'income'] },
        },
        required: ['name', 'type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rename_category',
      description:
        'Rename an existing category. Prefer categoryId from list_categories; otherwise match by current name (+ type).',
      parameters: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          fromName: { type: 'string', description: 'Current category name if id unknown' },
          toName: { type: 'string', description: 'New category name' },
          type: {
            type: 'string',
            enum: ['expense', 'income'],
            description: 'Disambiguate when multiple categories share a name',
          },
        },
        required: ['toName'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_category',
      description:
        'Delete a category. Transactions using it become uncategorized. Prefer categoryId from list_categories.',
      parameters: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          name: { type: 'string', description: 'Category name if id unknown' },
          type: {
            type: 'string',
            enum: ['expense', 'income'],
            description: 'Disambiguate when multiple categories share a name',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_report',
      description: 'Summarize the current space totals and recent activity for the user.',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            description: 'Optional focus, e.g. expenses, income, net, categories',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_categories',
      description: 'List categories available in the active space.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'plan_goal',
      description:
        'Preview a duration savings goal: monthly amount, start/end dates, and timeline. Does NOT create the goal — use create_goal after the user confirms.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Goal name, e.g. Gaming PC' },
          target: { type: 'number', description: 'Target amount in space currency (major units)' },
          durationMonths: {
            type: 'number',
            description: 'How many months to save over (default 3)',
          },
          startDate: { type: 'string', description: 'ISO date YYYY-MM-DD when saving starts; default today' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_goal',
      description:
        'Create a duration savings goal in the ledger after the user confirms the plan. Requires name, target, and duration.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Goal name' },
          target: { type: 'number', description: 'Target amount in space currency (major units)' },
          durationMonths: { type: 'number', description: 'Months to save (>= 1)' },
          startDate: { type: 'string', description: 'Optional ISO start date YYYY-MM-DD' },
        },
        required: ['name', 'target', 'durationMonths'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_goals',
      description: 'List savings goals in the active space.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_goal',
      description:
        'Update a savings goal: rename, log progress (saved amount), or change status (active/paused/completed/cancelled).',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'string' },
          query: { type: 'string', description: 'Match by goal name if id unknown' },
          name: { type: 'string' },
          savedAmount: {
            type: 'number',
            description: 'Total saved so far in space currency major units',
          },
          status: {
            type: 'string',
            enum: ['active', 'paused', 'completed', 'cancelled'],
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_goal',
      description: 'Delete a savings goal. Prefer goalId from list_goals.',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'string' },
          query: { type: 'string', description: 'Match by goal name if id unknown' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_recurring',
      description: 'List recurring salary/subscription items in the active space.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_recurring',
      description:
        'Create a monthly recurring income (salary) or expense (subscription/bill). dayOfMonth is 1–28.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number', description: 'Major units in space currency' },
          kind: { type: 'string', enum: ['income', 'expense'] },
          dayOfMonth: { type: 'number', description: 'Day of month 1–28 (default 1)' },
        },
        required: ['name', 'amount', 'kind'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_recurring',
      description: 'Update or pause/resume a recurring item.',
      parameters: {
        type: 'object',
        properties: {
          recurringId: { type: 'string' },
          query: { type: 'string', description: 'Match by name if id unknown' },
          name: { type: 'string' },
          amount: { type: 'number' },
          kind: { type: 'string', enum: ['income', 'expense'] },
          dayOfMonth: { type: 'number' },
          active: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_recurring',
      description: 'Delete a recurring salary or subscription.',
      parameters: {
        type: 'object',
        properties: {
          recurringId: { type: 'string' },
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_spaces',
      description: 'List spaces the user can switch into.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_space',
      description: 'Create a new space (project, family, company, or personal) and switch to it.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['personal', 'project', 'family', 'company'],
            description: 'Space type (default project)',
          },
          currency: { type: 'string', description: 'ISO currency; defaults to active space currency' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'switch_space',
      description: 'Switch the active space by id or name.',
      parameters: {
        type: 'object',
        properties: {
          spaceId: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'invite_member',
      description:
        'Invite someone to the active space by email. Roles: viewer, contributor, admin, child.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          role: {
            type: 'string',
            enum: ['viewer', 'contributor', 'admin', 'child'],
            description: 'Default contributor',
          },
        },
        required: ['email'],
      },
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
}

function formatMinor(amountMinor: number, currency: string) {
  const decimals = currencyDecimalPlaces(currency);
  const major = amountMinor / 10 ** decimals;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);
  } catch {
    return `${major.toFixed(decimals)} ${currency}`;
  }
}

function formatMajor(amount: number, currency: string) {
  const decimals = currencyDecimalPlaces(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals)} ${currency}`;
  }
}

function majorFromMinor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyDecimalPlaces(currency);
}

function majorToMinor(amountMajor: number, currency: string): number | null {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) return null;
  try {
    const decimals = currencyDecimalPlaces(currency as CurrencyCode);
    const display = amountMajor.toFixed(decimals);
    return parseDisplayAmount(display, currency as CurrencyCode);
  } catch {
    return null;
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeGoalPlan(input: {
  targetMajor: number;
  durationMonths: number;
  currency: string;
  startDate?: string;
  name?: string;
}):
  | {
      ok: true;
      name: string | null;
      targetMajor: number;
      targetMinor: number;
      durationMonths: number;
      startDate: string;
      endDate: string;
      monthlyMinor: number;
      monthlyMajor: number;
    }
  | { ok: false; error: string } {
  const targetMinor = majorToMinor(input.targetMajor, input.currency);
  if (targetMinor == null) return { ok: false, error: 'target must be a positive amount' };
  const durationMonths =
    Number.isFinite(input.durationMonths) && input.durationMonths >= 1
      ? Math.floor(input.durationMonths)
      : 3;
  const startDate = (input.startDate?.slice(0, 10) || todayIsoDate()).slice(0, 10);
  const endDate = addMonthsToIsoDate(startDate, durationMonths);
  const monthlyMinor = monthlyTargetMinor({
    targetMinor,
    durationMonths,
    plannedContributionMinor: 0,
  });
  return {
    ok: true,
    name: input.name?.trim() || null,
    targetMajor: input.targetMajor,
    targetMinor,
    durationMonths,
    startDate,
    endDate,
    monthlyMinor,
    monthlyMajor: majorFromMinor(monthlyMinor, input.currency),
  };
}

function goalPlanReportBody(
  plan: Extract<ReturnType<typeof computeGoalPlan>, { ok: true }>,
  currency: string,
): string {
  const lines = [
    plan.name ? `Goal: ${plan.name}` : 'Savings goal plan',
    `Target: ${formatMajor(plan.targetMajor, currency)}`,
    `Duration: ${plan.durationMonths} month${plan.durationMonths === 1 ? '' : 's'}`,
    `Start: ${plan.startDate}`,
    `End: ${plan.endDate}`,
    `Monthly save: ${formatMinor(plan.monthlyMinor, currency)}`,
  ];
  return lines.join('\n');
}

async function fetchFxRate(from: string, to: string): Promise<number> {
  const src = from.toUpperCase();
  const dst = to.toUpperCase();
  if (src === dst) return 1;

  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(src)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`FX lookup failed (${res.status})`);
  }
  const json = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  const rate = json.rates?.[dst];
  if (!rate || !Number.isFinite(rate)) {
    throw new Error(`No FX rate from ${src} to ${dst}`);
  }
  return rate;
}

function queueAskCategory(
  actions: AiAction[],
  context: AiLedgerContext,
  entryType: 'income' | 'expense',
  amount: number,
  when: string | undefined,
  hints: string[],
  note?: string,
) {
  const suggestions = buildCategorySuggestions(context, entryType, hints);
  actions.push({
    type: 'ask_category',
    entryType,
    amountMajor: amount,
    occurredAt: when,
    suggestions,
    note,
  });
  return {
    ok: true as const,
    result: {
      awaitingCategory: true,
      entryType,
      amount,
      currency: context.currency,
      suggestions: suggestions.map((s) => s.value),
      note: note ?? null,
    },
  };
}

function findRecentMatches(
  context: AiLedgerContext,
  opts: { query?: string; amount?: number | null; type?: string },
) {
  const q = opts.query?.toLowerCase();
  return context.recent.filter((r) => {
    if (opts.type && r.type !== opts.type) return false;
    if (opts.amount != null) {
      const major = majorFromMinor(r.amountMinor, context.currency);
      if (Math.abs(major - opts.amount) > 0.05) return false;
    }
    if (q) {
      const hay = `${r.description ?? ''} ${r.category ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function resolveTxnId(
  context: AiLedgerContext,
  args: Record<string, unknown>,
):
  | { ok: true; transactionId: string }
  | { ok: true; needDisambiguation: true; matches: ReturnType<typeof findRecentMatches> }
  | { ok: false; error: string } {
  let transactionId = asString(args.transactionId);
  if (!transactionId) {
    const matches = findRecentMatches(context, {
      query: asString(args.query),
      amount: asNumber(args.matchAmount),
    });
    if (matches.length === 0 && context.recent[0]) {
      const q = asString(args.query)?.toLowerCase();
      if (!q || q.includes('last') || q.includes('latest') || q.includes('recent')) {
        transactionId = context.recent[0].id;
      }
    } else if (matches.length === 1) {
      transactionId = matches[0]!.id;
    } else if (matches.length > 1) {
      return { ok: true, needDisambiguation: true, matches };
    }
  }
  if (!transactionId && context.recent[0]) transactionId = context.recent[0].id;
  if (!transactionId) return { ok: false, error: 'Could not find an entry' };
  return { ok: true, transactionId };
}

function resolveGoalId(
  context: AiLedgerContext,
  args: Record<string, unknown>,
): { ok: true; goalId: string } | { ok: false; error: string } {
  const goals = context.goals ?? [];
  let goalId = asString(args.goalId);
  if (!goalId) {
    const q = asString(args.query)?.toLowerCase();
    if (q) {
      const matches = goals.filter((g) => g.name.toLowerCase().includes(q));
      if (matches.length === 1) goalId = matches[0]!.id;
      else if (matches.length > 1) {
        return {
          ok: false,
          error: `Multiple goals match — pick one: ${matches.map((g) => `${g.name} (${g.id})`).join(', ')}`,
        };
      }
    }
  }
  if (!goalId && goals.length === 1) goalId = goals[0]!.id;
  if (!goalId) return { ok: false, error: 'Could not find a goal — call list_goals first' };
  return { ok: true, goalId };
}

function resolveRecurringId(
  context: AiLedgerContext,
  args: Record<string, unknown>,
): { ok: true; recurringId: string } | { ok: false; error: string } {
  const items = context.recurring ?? [];
  let recurringId = asString(args.recurringId);
  if (!recurringId) {
    const q = asString(args.query)?.toLowerCase();
    if (q) {
      const matches = items.filter((r) => r.name.toLowerCase().includes(q));
      if (matches.length === 1) recurringId = matches[0]!.id;
      else if (matches.length > 1) {
        return {
          ok: false,
          error: `Multiple recurring items match — pick one: ${matches.map((r) => `${r.name} (${r.id})`).join(', ')}`,
        };
      }
    }
  }
  if (!recurringId && items.length === 1) recurringId = items[0]!.id;
  if (!recurringId) {
    return { ok: false, error: 'Could not find a recurring item — call list_recurring first' };
  }
  return { ok: true, recurringId };
}

function resolveCategory(
  context: AiLedgerContext,
  opts: { categoryId?: string; name?: string; type?: string },
):
  | { ok: true; category: AiLedgerContext['categories'][number] }
  | { ok: false; error: string } {
  if (opts.categoryId) {
    const byId = context.categories.find((c) => c.id === opts.categoryId);
    if (!byId) return { ok: false, error: 'Category id not found' };
    return { ok: true, category: byId };
  }
  const name = opts.name?.toLowerCase();
  if (!name) return { ok: false, error: 'Provide categoryId or name' };
  let matches = context.categories.filter((c) => c.name.toLowerCase() === name);
  if (opts.type === 'income' || opts.type === 'expense') {
    matches = matches.filter((c) => c.type === opts.type);
  }
  if (matches.length === 0) {
    matches = context.categories.filter((c) => c.name.toLowerCase().includes(name));
    if (opts.type === 'income' || opts.type === 'expense') {
      matches = matches.filter((c) => c.type === opts.type);
    }
  }
  if (matches.length === 0) return { ok: false, error: `No category named like "${opts.name}"` };
  if (matches.length > 1) {
    return {
      ok: false,
      error: `Multiple categories match — pick one: ${matches.map((c) => `${c.name} (${c.type}, ${c.id})`).join(', ')}`,
    };
  }
  return { ok: true, category: matches[0]! };
}

export async function runAiTool(
  name: string,
  rawArgs: unknown,
  context: AiLedgerContext,
  actions: AiAction[],
): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  const args = asRecord(typeof rawArgs === 'string' ? safeJson(rawArgs) : rawArgs);

  switch (name) {
    case 'convert_currency': {
      const amount = asNumber(args.amount);
      const from = asString(args.from)?.toUpperCase();
      const to = (asString(args.to) ?? context.currency).toUpperCase();
      if (amount === null || amount <= 0) return { ok: false, error: 'amount must be positive' };
      if (!from) return { ok: false, error: 'from currency required' };
      try {
        const rate = await fetchFxRate(from, to);
        const decimals = currencyDecimalPlaces(to);
        const factor = 10 ** decimals;
        const converted = Math.round(amount * rate * factor) / factor;
        return {
          ok: true,
          result: {
            amount,
            from,
            to,
            rate,
            converted,
            formatted: `${formatMajor(amount, from)} ≈ ${formatMajor(converted, to)}`,
            noteHint: `${amount} ${from}`,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'FX lookup failed',
        };
      }
    }
    case 'find_entries': {
      const matches = findRecentMatches(context, {
        query: asString(args.query),
        amount: asNumber(args.amount),
        type: asString(args.type),
      }).slice(0, 8);
      return {
        ok: true,
        result: {
          count: matches.length,
          entries: matches.map((m) => ({
            id: m.id,
            type: m.type,
            amount: majorFromMinor(m.amountMinor, context.currency),
            currency: context.currency,
            category: m.category,
            note: m.description,
            occurredAt: m.occurredAt,
          })),
        },
      };
    }
    case 'update_entry': {
      const newNote = asString(args.newNote);
      const newCategory = asString(args.newCategory);
      const newAmount = asNumber(args.newAmount);
      const newWhen = asString(args.newWhen);
      if (!newNote && !newCategory && newAmount == null && !newWhen) {
        return { ok: false, error: 'Provide newNote, newCategory, newAmount, and/or newWhen' };
      }

      const resolved = resolveTxnId(context, args);
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      if ('needDisambiguation' in resolved) {
        return {
          ok: true,
          result: {
            needDisambiguation: true,
            matches: resolved.matches.map((m) => ({
              id: m.id,
              note: m.description,
              category: m.category,
              amount: majorFromMinor(m.amountMinor, context.currency),
            })),
          },
        };
      }
      const transactionId = resolved.transactionId;

      if (newCategory) {
        const entry = context.recent.find((r) => r.id === transactionId);
        const entryType = entry?.type === 'income' ? 'income' : 'expense';
        const exists = context.categories.some(
          (c) => c.type === entryType && c.name.toLowerCase() === newCategory.toLowerCase(),
        );
        if (!exists) {
          actions.push({ type: 'create_category', name: newCategory, categoryType: entryType });
        }
      }

      actions.push({
        type: 'update_transaction',
        transactionId,
        note: newNote,
        category: newCategory,
        amountMajor: newAmount ?? undefined,
        occurredAt: newWhen,
      });

      return {
        ok: true,
        result: {
          queued: true,
          transactionId,
          newNote: newNote ?? null,
          newCategory: newCategory ?? null,
          newAmount: newAmount ?? null,
          newWhen: newWhen ?? null,
        },
      };
    }
    case 'delete_entry':
    case 'hide_entry': {
      const resolved = resolveTxnId(context, args);
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      if ('needDisambiguation' in resolved) {
        return {
          ok: true,
          result: {
            needDisambiguation: true,
            matches: resolved.matches.map((m) => ({
              id: m.id,
              note: m.description,
              category: m.category,
              amount: majorFromMinor(m.amountMinor, context.currency),
            })),
          },
        };
      }
      if (name === 'delete_entry') {
        actions.push({ type: 'delete_transaction', transactionId: resolved.transactionId });
      } else {
        actions.push({ type: 'hide_transaction', transactionId: resolved.transactionId });
      }
      return {
        ok: true,
        result: { queued: true, transactionId: resolved.transactionId, action: name },
      };
    }
    case 'ask_for_category': {
      const amount = asNumber(args.amount);
      if (amount === null || amount <= 0) {
        return { ok: false, error: 'amount must be a positive number' };
      }
      const entryType = asString(args.type) === 'income' ? 'income' : 'expense';
      return queueAskCategory(
        actions,
        context,
        entryType,
        amount,
        asString(args.when),
        asStringArray(args.hints),
        asString(args.note),
      );
    }
    case 'add_expense':
    case 'add_income': {
      const amount = asNumber(args.amount);
      if (amount === null || amount <= 0) {
        return { ok: false, error: 'amount must be a positive number' };
      }
      const entryType = name === 'add_income' ? 'income' : 'expense';
      const category = asString(args.category);
      const note = asString(args.note);
      const when = asString(args.when);

      if (!category) {
        return queueAskCategory(actions, context, entryType, amount, when, [], note);
      }

      const existing = context.categories.find(
        (c) => c.type === entryType && c.name.toLowerCase() === category.toLowerCase(),
      );
      if (!existing) {
        actions.push({ type: 'create_category', name: category, categoryType: entryType });
      }

      actions.push({
        type: 'add_transaction',
        entryType,
        amountMajor: amount,
        category,
        note,
        occurredAt: when,
      });

      return {
        ok: true,
        result: {
          queued: true,
          entryType,
          amount,
          currency: context.currency,
          category,
        },
      };
    }
    case 'create_category': {
      const nameValue = asString(args.name);
      const typeValue = asString(args.type) === 'income' ? 'income' : 'expense';
      if (!nameValue) return { ok: false, error: 'name is required' };
      const exists = context.categories.some(
        (c) => c.type === typeValue && c.name.toLowerCase() === nameValue.toLowerCase(),
      );
      if (!exists) {
        actions.push({ type: 'create_category', name: nameValue, categoryType: typeValue });
      }
      return {
        ok: true,
        result: { queued: !exists, name: nameValue, type: typeValue, alreadyExists: exists },
      };
    }
    case 'rename_category': {
      const toName = asString(args.toName);
      if (!toName) return { ok: false, error: 'toName is required' };
      const resolved = resolveCategory(context, {
        categoryId: asString(args.categoryId),
        name: asString(args.fromName),
        type: asString(args.type),
      });
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      const conflict = context.categories.some(
        (c) =>
          c.id !== resolved.category.id &&
          c.type === resolved.category.type &&
          c.name.toLowerCase() === toName.toLowerCase(),
      );
      if (conflict) {
        return { ok: false, error: `A ${resolved.category.type} category named "${toName}" already exists` };
      }
      actions.push({
        type: 'rename_category',
        categoryId: resolved.category.id,
        fromName: resolved.category.name,
        toName,
        categoryType: resolved.category.type,
      });
      return {
        ok: true,
        result: {
          queued: true,
          categoryId: resolved.category.id,
          fromName: resolved.category.name,
          toName,
          type: resolved.category.type,
        },
      };
    }
    case 'delete_category': {
      const resolved = resolveCategory(context, {
        categoryId: asString(args.categoryId),
        name: asString(args.name),
        type: asString(args.type),
      });
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      actions.push({
        type: 'delete_category',
        categoryId: resolved.category.id,
        name: resolved.category.name,
        categoryType: resolved.category.type,
      });
      return {
        ok: true,
        result: {
          queued: true,
          categoryId: resolved.category.id,
          name: resolved.category.name,
          type: resolved.category.type,
        },
      };
    }
    case 'list_categories': {
      return {
        ok: true,
        result: {
          categories: context.categories.map((c) => ({ name: c.name, type: c.type })),
        },
      };
    }
    case 'plan_goal': {
      const target = asNumber(args.target);
      if (target === null || target <= 0) return { ok: false, error: 'target must be positive' };
      const durationMonths = asNumber(args.durationMonths) ?? 3;
      const plan = computeGoalPlan({
        targetMajor: target,
        durationMonths,
        currency: context.currency,
        startDate: asString(args.startDate),
        name: asString(args.name),
      });
      if ('error' in plan) return { ok: false, error: plan.error };
      const title = plan.name ? `Plan: ${plan.name}` : 'Savings goal plan';
      const body = goalPlanReportBody(plan, context.currency);
      actions.push({ type: 'report', title, body });
      return {
        ok: true,
        result: {
          previewOnly: true,
          name: plan.name,
          target: plan.targetMajor,
          targetMinor: plan.targetMinor,
          currency: context.currency,
          durationMonths: plan.durationMonths,
          startDate: plan.startDate,
          endDate: plan.endDate,
          monthlyAmount: plan.monthlyMajor,
          monthlyMinor: plan.monthlyMinor,
          formattedMonthly: formatMinor(plan.monthlyMinor, context.currency),
        },
      };
    }
    case 'create_goal': {
      const nameValue = asString(args.name);
      const target = asNumber(args.target);
      const durationRaw = asNumber(args.durationMonths);
      if (!nameValue) return { ok: false, error: 'name is required' };
      if (target === null || target <= 0) return { ok: false, error: 'target must be positive' };
      if (durationRaw === null || durationRaw < 1) {
        return { ok: false, error: 'durationMonths must be at least 1' };
      }
      const durationMonths = Math.floor(durationRaw);
      const plan = computeGoalPlan({
        targetMajor: target,
        durationMonths,
        currency: context.currency,
        startDate: asString(args.startDate),
        name: nameValue,
      });
      if ('error' in plan) return { ok: false, error: plan.error };
      actions.push({
        type: 'create_goal',
        name: nameValue,
        targetMajor: target,
        durationMonths,
        startDate: plan.startDate,
      });
      return {
        ok: true,
        result: {
          queued: true,
          name: nameValue,
          target: target,
          currency: context.currency,
          durationMonths,
          startDate: plan.startDate,
          endDate: plan.endDate,
          monthlyAmount: plan.monthlyMajor,
          formattedMonthly: formatMinor(plan.monthlyMinor, context.currency),
        },
      };
    }
    case 'list_goals': {
      const goals = context.goals ?? [];
      return {
        ok: true,
        result: {
          count: goals.length,
          goals: goals.map((g) => ({
            id: g.id,
            name: g.name,
            target: majorFromMinor(g.targetMinor, context.currency),
            saved: majorFromMinor(g.savedMinor, context.currency),
            durationMonths: g.durationMonths,
            status: g.status,
            paceStatus: g.paceStatus ?? null,
          })),
        },
      };
    }
    case 'update_goal': {
      const resolved = resolveGoalId(context, args);
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      const nameValue = asString(args.name);
      const savedAmount = asNumber(args.savedAmount);
      const status = asString(args.status);
      if (!nameValue && savedAmount == null && !status) {
        return { ok: false, error: 'Provide name, savedAmount, and/or status' };
      }
      actions.push({
        type: 'update_goal',
        goalId: resolved.goalId,
        name: nameValue,
        savedMajor: savedAmount ?? undefined,
        status,
      });
      return {
        ok: true,
        result: { queued: true, goalId: resolved.goalId, name: nameValue ?? null, savedAmount, status },
      };
    }
    case 'delete_goal': {
      const resolved = resolveGoalId(context, args);
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      actions.push({ type: 'delete_goal', goalId: resolved.goalId });
      return { ok: true, result: { queued: true, goalId: resolved.goalId } };
    }
    case 'list_recurring': {
      const items = context.recurring ?? [];
      return {
        ok: true,
        result: {
          count: items.length,
          recurring: items.map((r) => ({
            id: r.id,
            name: r.name,
            amount: majorFromMinor(r.amountMinor, context.currency),
            kind: r.kind,
            dayOfMonth: r.dayOfMonth,
            active: r.active,
          })),
        },
      };
    }
    case 'create_recurring': {
      const nameValue = asString(args.name);
      const amount = asNumber(args.amount);
      const kind = asString(args.kind) === 'income' ? 'income' : 'expense';
      const dayRaw = asNumber(args.dayOfMonth) ?? 1;
      if (!nameValue) return { ok: false, error: 'name is required' };
      if (amount === null || amount <= 0) return { ok: false, error: 'amount must be positive' };
      const dayOfMonth = Math.min(28, Math.max(1, Math.floor(dayRaw)));
      actions.push({
        type: 'create_recurring',
        name: nameValue,
        amountMajor: amount,
        kind,
        dayOfMonth,
      });
      return {
        ok: true,
        result: { queued: true, name: nameValue, amount, kind, dayOfMonth },
      };
    }
    case 'update_recurring': {
      const resolved = resolveRecurringId(context, args);
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      const nameValue = asString(args.name);
      const amount = asNumber(args.amount);
      const kindRaw = asString(args.kind);
      const kind =
        kindRaw === 'income' || kindRaw === 'expense' ? kindRaw : undefined;
      const dayRaw = asNumber(args.dayOfMonth);
      const active = typeof args.active === 'boolean' ? args.active : undefined;
      if (
        !nameValue &&
        amount == null &&
        !kind &&
        dayRaw == null &&
        active === undefined
      ) {
        return { ok: false, error: 'Provide at least one field to update' };
      }
      actions.push({
        type: 'update_recurring',
        recurringId: resolved.recurringId,
        name: nameValue,
        amountMajor: amount ?? undefined,
        kind,
        dayOfMonth:
          dayRaw == null ? undefined : Math.min(28, Math.max(1, Math.floor(dayRaw))),
        active,
      });
      return { ok: true, result: { queued: true, recurringId: resolved.recurringId } };
    }
    case 'delete_recurring': {
      const resolved = resolveRecurringId(context, args);
      if (resolved.ok === false) return { ok: false, error: resolved.error };
      actions.push({ type: 'delete_recurring', recurringId: resolved.recurringId });
      return { ok: true, result: { queued: true, recurringId: resolved.recurringId } };
    }
    case 'list_spaces': {
      const spaces = context.spaces ?? [];
      return {
        ok: true,
        result: {
          activeSpaceId: context.spaceId,
          spaces: spaces.map((s) => ({
            id: s.id,
            name: s.name,
            currency: s.currency,
            active: s.id === context.spaceId,
          })),
        },
      };
    }
    case 'create_space': {
      const nameValue = asString(args.name);
      if (!nameValue) return { ok: false, error: 'name is required' };
      const typeRaw = asString(args.type) ?? 'project';
      const spaceType =
        typeRaw === 'personal' ||
        typeRaw === 'family' ||
        typeRaw === 'company' ||
        typeRaw === 'project'
          ? typeRaw
          : 'project';
      const currency = asString(args.currency)?.toUpperCase() ?? context.currency;
      actions.push({ type: 'create_space', name: nameValue, spaceType, currency });
      return {
        ok: true,
        result: { queued: true, name: nameValue, type: spaceType, currency },
      };
    }
    case 'switch_space': {
      const spaceId = asString(args.spaceId);
      const nameValue = asString(args.name);
      if (!spaceId && !nameValue) {
        return { ok: false, error: 'Provide spaceId or name' };
      }
      if (nameValue && !spaceId) {
        const spaces = context.spaces ?? [];
        const matches = spaces.filter((s) =>
          s.name.toLowerCase().includes(nameValue.toLowerCase()),
        );
        if (matches.length === 0) {
          return { ok: false, error: `No space named like "${nameValue}"` };
        }
        if (matches.length > 1) {
          return {
            ok: false,
            error: `Multiple spaces match: ${matches.map((s) => s.name).join(', ')}`,
          };
        }
        actions.push({
          type: 'switch_space',
          spaceId: matches[0]!.id,
          spaceName: matches[0]!.name,
        });
        return { ok: true, result: { queued: true, spaceId: matches[0]!.id } };
      }
      actions.push({ type: 'switch_space', spaceId, spaceName: nameValue });
      return { ok: true, result: { queued: true, spaceId, spaceName: nameValue ?? null } };
    }
    case 'invite_member': {
      const email = asString(args.email)?.toLowerCase();
      if (!email || !email.includes('@')) return { ok: false, error: 'Valid email required' };
      const roleRaw = asString(args.role) ?? 'contributor';
      const role =
        roleRaw === 'viewer' ||
        roleRaw === 'admin' ||
        roleRaw === 'child' ||
        roleRaw === 'contributor'
          ? roleRaw
          : 'contributor';
      actions.push({ type: 'invite_member', email, role });
      return { ok: true, result: { queued: true, email, role } };
    }
    case 'get_report': {
      const focus = asString(args.focus) ?? 'overview';
      const body = [
        `Space: ${context.spaceName} (${context.currency})`,
        `Income: ${formatMinor(context.totals.incomeMinor, context.currency)}`,
        `Expenses: ${formatMinor(context.totals.expenseMinor, context.currency)}`,
        `Net: ${formatMinor(context.totals.netMinor, context.currency)}`,
        context.recent.length
          ? `Recent: ${context.recent
              .slice(0, 5)
              .map(
                (r) =>
                  `${r.id} ${r.type} ${formatMinor(r.amountMinor, context.currency)}${r.category ? ` · ${r.category}` : ''}${r.description ? ` (${r.description})` : ''}`,
              )
              .join('; ')}`
          : 'Recent: none yet',
      ].join('\n');

      actions.push({
        type: 'report',
        title: focus === 'overview' ? 'Space summary' : `Focus: ${focus}`,
        body,
      });

      return { ok: true, result: { focus, summary: body } };
    }
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function buildSystemPrompt(context: AiLedgerContext): string {
  const cats = context.categories
    .map((c) => `${c.name} (${c.type})`)
    .slice(0, 40)
    .join(', ');

  const recentLines = context.recent
    .slice(0, 6)
    .map(
      (r) =>
        `- id=${r.id} ${r.type} ${formatMinor(r.amountMinor, context.currency)} · ${r.category ?? 'uncategorized'} · note="${r.description ?? ''}"`,
    )
    .join('\n');

  const goalLines = (context.goals ?? [])
    .slice(0, 6)
    .map(
      (g) =>
        `- id=${g.id} "${g.name}" ${formatMinor(g.savedMinor, context.currency)}/${formatMinor(g.targetMinor, context.currency)} · ${g.durationMonths}mo · ${g.status}${g.paceStatus ? ` · ${g.paceStatus}` : ''}`,
    )
    .join('\n');

  const recurringLines = (context.recurring ?? [])
    .slice(0, 6)
    .map(
      (r) =>
        `- id=${r.id} "${r.name}" ${r.kind} ${formatMinor(r.amountMinor, context.currency)} day ${r.dayOfMonth}${r.active ? '' : ' (paused)'}`,
    )
    .join('\n');

  const spaceLines = (context.spaces ?? [])
    .map((s) => `- id=${s.id} "${s.name}" ${s.currency}${s.id === context.spaceId ? ' (active)' : ''}`)
    .join('\n');

  return [
    'You are Penny — Clear Money’s companion: a calm gold-coin guide with a soft indigo orbit vibe.',
    'Always speak in first person as Penny. Never call yourself “the assistant”, “an AI”, or “a chatbot”.',
    'If asked who you are: you’re Penny, the Clear Money companion who helps with everything in the ledger — spend, income, categories, goals, recurring, spaces, invites, and reports.',
    'Tone: warm, sharp, lightly funny. Dry humor about money is welcome, but never spam jokes — at most one short quip when it fits.',
    'Keep answers concise and conversational, like a coach sitting next to the ledger — not a corporate FAQ.',
    'CRITICAL — anything the user can do in the app, they can ask you to do. Use tools for every ledger mutation. Never pretend you saved/created/deleted/switched something without a tool call.',
    'Capabilities (always use the matching tool):',
    '- Spend / income: add_expense, add_income, ask_for_category, convert_currency',
    '- Categories: create_category, rename_category, delete_category, list_categories',
    '- Edit entries: find_entries, update_entry (note, category, amount, date), delete_entry, hide_entry',
    '- Goals: plan_goal, create_goal, list_goals, update_goal (progress/rename/status), delete_goal',
    '- Recurring salary/bills: list_recurring, create_recurring, update_recurring, delete_recurring',
    '- Spaces: list_spaces, create_space, switch_space',
    '- Members: invite_member',
    '- Insights: get_report',
    'CRITICAL money entry flow:',
    `1) Amounts without an explicit foreign currency code are already in ${context.currency}. Do NOT call convert_currency for them.`,
    `2) Only call convert_currency when the user names a currency code different from ${context.currency}.`,
    '3) If amount has no category, you MUST call ask_for_category (UI shows chips). Never ask for category in free text only.',
    '4) If category is already clear (e.g. “on coffee”), call add_expense/add_income with that category.',
    '5) When the user asks to create a category, call create_category — do not only acknowledge in chat.',
    '5b) Rename with rename_category; remove with delete_category (entries become uncategorized).',
    '6) Notes are optional after save — do not block saving on a note.',
    'Savings goals (duration-based): preview with plan_goal, then create_goal after confirm. Log progress with update_goal(savedAmount=…).',
    'Editing / removing: “change the last note/amount” → update_entry; “delete/undo that spend” → delete_entry; “hide it” → hide_entry.',
    'Recurring: “my salary is 3000 on the 1st” → create_recurring; pause/delete with update_recurring / delete_recurring.',
    'Spaces: “create a Family space” → create_space; “switch to Work” → switch_space; “invite alex@…” → invite_member.',
    'Use tools for ledger facts. Do not invent balances or FX rates.',
    `Amounts the ledger stores are in ${context.currency} major units.`,
    'No investment, tax, or lending advice.',
    `Active space: ${context.spaceName}. Currency: ${context.currency}. Always format money as ${context.currency}, never assume USD.`,
    `Categories: ${cats || 'none yet'}.`,
    `Current totals — income ${formatMinor(context.totals.incomeMinor, context.currency)}, expenses ${formatMinor(context.totals.expenseMinor, context.currency)}, net ${formatMinor(context.totals.netMinor, context.currency)}.`,
    recentLines ? `Recent entries:\n${recentLines}` : 'Recent entries: none.',
    goalLines ? `Goals:\n${goalLines}` : 'Goals: none.',
    recurringLines ? `Recurring:\n${recurringLines}` : 'Recurring: none.',
    spaceLines ? `Spaces:\n${spaceLines}` : `Spaces: active ${context.spaceName} (${context.spaceId}).`,
  ].join('\n');
}
