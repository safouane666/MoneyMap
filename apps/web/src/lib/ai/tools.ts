import {
  addMonthsToIsoDate,
  categoryBreakdown,
  currencyDecimalPlaces,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  filterTransactionsByPeriod,
  formatCategoryChip,
  matchDefaultCategoryHint,
  monthlyTargetMinor,
  normalizeRecurringDuration,
  parseDisplayAmount,
  reportSnapshot,
  stripCategoryEmoji,
  type CurrencyCode,
  type LedgerTransaction,
  type ReportPeriod,
} from '@clear-money/domain';
import {
  AI_CONTEXT_TXN_LIMIT,
  type AiAction,
  type AiChartKind,
  type AiChartPoint,
  type AiLedgerContext,
  type AiSuggestion,
} from './types';

const EXPENSE_DEFAULTS: AiSuggestion[] = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
  label: formatCategoryChip(c.name, c.stableKey),
  value: c.name,
  icon: iconKeyForStable(c.stableKey),
}));

const INCOME_DEFAULTS: AiSuggestion[] = DEFAULT_INCOME_CATEGORIES.map((c) => ({
  label: formatCategoryChip(c.name, c.stableKey),
  value: c.name,
  icon: iconKeyForStable(c.stableKey),
}));

function iconKeyForStable(stableKey: string): string {
  const map: Record<string, string> = {
    groceries: 'utensils',
    food_drinks: 'utensils',
    housing: 'home',
    bills: 'zap',
    transport: 'car',
    shopping: 'shopping-bag',
    entertainment: 'party-popper',
    health: 'heart',
    education: 'book',
    travel: 'plane',
    gifts: 'gift',
    family: 'users',
    loans_debts: 'banknote',
    other: 'circle-dot',
    salary: 'briefcase',
    freelance: 'laptop',
    bonus: 'sparkles',
    gift_income: 'gift',
    other_income: 'circle-dot',
  };
  return map[stableKey] ?? 'tag';
}

const ICON_BY_NAME: Record<string, string> = {
  food: 'utensils',
  groceries: 'utensils',
  'food & drinks': 'utensils',
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
  gifts: 'gift',
  bills: 'zap',
  education: 'book',
  travel: 'plane',
  family: 'users',
  'loans & debts': 'banknote',
  subscriptions: 'repeat',
  other: 'circle-dot',
};

export function iconForCategory(name: string): string {
  return ICON_BY_NAME[stripCategoryEmoji(name).trim().toLowerCase()] ?? 'tag';
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
      label: formatCategoryChip(c.name),
      value: stripCategoryEmoji(c.name) || c.name,
      icon: iconForCategory(c.name),
    }));

  const fromHints = extraHints
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => {
      const mapped = matchDefaultCategoryHint(h, entryType) ?? stripCategoryEmoji(h) ?? h;
      return {
        label: formatCategoryChip(mapped),
        value: mapped,
        icon: iconForCategory(mapped),
      };
    });

  const merged = [...fromHints, ...fromLedger, ...defaults];
  const seen = new Set<string>();
  const unique: AiSuggestion[] = [];
  for (const item of merged) {
    const key = item.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 10) break;
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
      description:
        'Search the ledger pool (not just the last few rows) by note, category, amount, or type. Returns match totals plus sample entries. Prefer analyze_category when the user wants income vs spend for a named category.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to match in note or category' },
          amount: { type: 'number', description: 'Major-unit amount to match approximately' },
          type: { type: 'string', enum: ['expense', 'income'] },
          period: {
            type: 'string',
            enum: ['thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'allTime'],
            description: 'Optional period filter (default allTime)',
          },
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
      description:
        'REQUIRED for overall spending/income/trend/hour questions. Returns real period totals plus structured series and a chart. For a named category (e.g. Sponsore income vs spend, difference/won/lost), use analyze_category instead. Never answer from memory.',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            description:
              'Optional focus: expenses/spending, income/earnings, net, categories, trend, hours',
          },
          period: {
            type: 'string',
            enum: ['thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'allTime'],
            description: 'Report window (default thisMonth)',
          },
          chart: {
            type: 'string',
            enum: ['auto', 'category', 'trend', 'hours', 'none'],
            description:
              'Chart to show: category = top categories (expense or income from focus), trend = income vs expense over time, hours = spending by hour of day. Default auto picks from focus.',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_category',
      description:
        'REQUIRED when the user asks about one category (or same-named income+expense categories): totals, counts, and income−expense difference across the full period pool. Use for “how much did I win/lose on Sponsore”, “difference between my two Sponsore categories”, etc. Never estimate from recent rows alone.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Category name or fragment, e.g. Sponsore',
          },
          period: {
            type: 'string',
            enum: ['thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'allTime'],
            description: 'Window (default thisMonth)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_categories',
      description: 'List categories available in the active space (includes type: income vs expense).',
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
        'Create a monthly recurring income (salary) or expense (subscription/loan/bill). dayOfMonth is 1–28. Optional duration: durationUnit forever (default) | months | years with durationCount (e.g. a 24-month loan).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number', description: 'Major units in space currency' },
          kind: { type: 'string', enum: ['income', 'expense'] },
          dayOfMonth: { type: 'number', description: 'Day of month 1–28 (default 1)' },
          durationUnit: {
            type: 'string',
            enum: ['forever', 'months', 'years'],
            description: 'How long it repeats (default forever)',
          },
          durationCount: {
            type: 'number',
            description: 'Number of months/years; required unless durationUnit is forever',
          },
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
          durationUnit: { type: 'string', enum: ['forever', 'months', 'years'] },
          durationCount: {
            type: 'number',
            description: 'Number of months/years; required unless durationUnit is forever',
          },
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
      description: 'Create a new space (personal, household, shared, project, family, or company) and switch to it.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['personal', 'household', 'shared', 'project', 'family', 'company'],
            description: 'Space type (default shared)',
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

type SearchableEntry = {
  id: string;
  type: string;
  amountMinor: number;
  description: string | null;
  category: string | null;
  categoryId: string | null;
  occurredAt: string;
};

function normalizeCategoryQuery(name: string): string {
  return stripCategoryEmoji(name).trim().toLowerCase();
}

/** Full searchable pool from compact txns (+ recent fallback). */
function searchableEntries(context: AiLedgerContext): SearchableEntry[] {
  const fromTxns = (Array.isArray(context.txns) ? context.txns : [])
    .slice(0, AI_CONTEXT_TXN_LIMIT)
    .filter(
      (t) =>
        (t.type === 'income' || t.type === 'expense') &&
        Number.isFinite(t.amountMinor) &&
        t.amountMinor > 0 &&
        Number.isFinite(Date.parse(t.occurredAt)),
    )
    .map((t, i) => {
      const catName =
        t.category ??
        (t.categoryId
          ? context.categories.find((c) => c.id === t.categoryId)?.name ?? null
          : null);
      return {
        id: t.id || `ctx_${i}`,
        type: t.type,
        amountMinor: t.amountMinor,
        description: t.description ?? null,
        category: catName,
        categoryId: t.categoryId,
        occurredAt: t.occurredAt,
      };
    });
  if (fromTxns.length) return fromTxns;
  return context.recent.map((r) => ({
    id: r.id,
    type: r.type,
    amountMinor: r.amountMinor,
    description: r.description,
    category: r.category,
    categoryId: null,
    occurredAt: r.occurredAt,
  }));
}

function findRecentMatches(
  context: AiLedgerContext,
  opts: {
    query?: string;
    amount?: number | null;
    type?: string;
    period?: ReportPeriod;
  },
) {
  const q = opts.query ? normalizeCategoryQuery(opts.query) : '';
  let rows = searchableEntries(context);
  if (opts.period && opts.period !== 'allTime') {
    const asTxn = rows.map((r) => ({
      id: r.id,
      spaceId: context.spaceId,
      type: r.type as LedgerTransaction['type'],
      amountMinor: r.amountMinor,
      currency: context.currency,
      categoryId: r.categoryId,
      description: r.description,
      occurredAt: r.occurredAt,
      createdAt: r.occurredAt,
      createdBy: '',
      source: 'manual' as const,
      status: 'confirmed' as const,
    }));
    const scoped = new Set(filterTransactionsByPeriod(asTxn, opts.period).map((t) => t.id));
    rows = rows.filter((r) => scoped.has(r.id));
  }
  return rows.filter((r) => {
    if (opts.type && r.type !== opts.type) return false;
    if (opts.amount != null) {
      const major = majorFromMinor(r.amountMinor, context.currency);
      if (Math.abs(major - opts.amount) > 0.05) return false;
    }
    if (q) {
      const hay = normalizeCategoryQuery(`${r.description ?? ''} ${r.category ?? ''}`);
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

const REPORT_PERIODS: readonly ReportPeriod[] = [
  'thisWeek',
  'thisMonth',
  'lastMonth',
  'last3Months',
  'thisYear',
  'allTime',
];

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  thisWeek: 'this week',
  thisMonth: 'this month',
  lastMonth: 'last month',
  last3Months: 'last 3 months',
  thisYear: 'this year',
  allTime: 'all time',
};

const PERIOD_TITLE: Record<ReportPeriod, string> = {
  thisWeek: 'This week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  last3Months: 'Last 3 months',
  thisYear: 'This year',
  allTime: 'All time',
};

/** Human-facing recent line — never include transaction ids. */
function formatRecentEntryHuman(
  r: { type: string; amountMinor: number; description: string | null; category: string | null },
  currency: string,
): string {
  const label =
    (r.description && r.description.trim()) ||
    (r.category && r.category.trim()) ||
    (r.type === 'income' ? 'Income' : 'Expense');
  const direction = r.type === 'income' ? 'in' : 'out';
  return `${label} · ${formatMinor(r.amountMinor, currency)} ${direction}`;
}

function buildHumanReportBody(input: {
  spaceName: string;
  currency: string;
  periodLabel?: string;
  focus?: string;
  totals: { incomeMinor: number; expenseMinor: number; netMinor: number };
  topCategory?: { name: string; amountMinor: number; share: number } | null;
  topIncome?: { name: string; amountMinor: number; share: number } | null;
  recent: Array<{
    type: string;
    amountMinor: number;
    description: string | null;
    category: string | null;
  }>;
}): string {
  const { spaceName, currency, periodLabel, focus, totals, topCategory, topIncome, recent } =
    input;
  const f = (focus ?? '').toLowerCase();
  const incomeFocus = /\b(income|earn|salary|receiv|revenu|دخل|راتب)\b/.test(f);
  const expenseFocus = /\b(spend|expense|outgo|dépens|مصروف)\b/.test(f);

  const lines = [
    periodLabel ? `${spaceName} · ${periodLabel}` : spaceName,
    incomeFocus
      ? `Income ${formatMinor(totals.incomeMinor, currency)} · expenses ${formatMinor(totals.expenseMinor, currency)} for context · net ${formatMinor(totals.netMinor, currency)}`
      : expenseFocus
        ? `Expenses ${formatMinor(totals.expenseMinor, currency)} · income ${formatMinor(totals.incomeMinor, currency)} for context · net ${formatMinor(totals.netMinor, currency)}`
        : `In ${formatMinor(totals.incomeMinor, currency)} · out ${formatMinor(totals.expenseMinor, currency)} · net ${formatMinor(totals.netMinor, currency)}`,
  ];
  if (incomeFocus && topIncome) {
    lines.push(
      `Top income source: ${topIncome.name} · ${formatMinor(topIncome.amountMinor, currency)} (${Math.round(topIncome.share * 100)}%)`,
    );
  } else if (topCategory) {
    lines.push(
      `Biggest spend: ${topCategory.name} · ${formatMinor(topCategory.amountMinor, currency)} (${Math.round(topCategory.share * 100)}%)`,
    );
  }
  const recentSlice = incomeFocus
    ? recent.filter((r) => r.type === 'income').slice(0, 5)
    : expenseFocus
      ? recent.filter((r) => r.type === 'expense').slice(0, 5)
      : recent.slice(0, 5);
  const recentForLine = recentSlice.length ? recentSlice : recent.slice(0, 5);
  if (recentForLine.length) {
    lines.push(
      `Latest: ${recentForLine.map((r) => formatRecentEntryHuman(r, currency)).join('; ')}`,
    );
  } else {
    lines.push('Latest: nothing logged yet');
  }
  return lines.join('\n');
}

function uiLocale(context: AiLedgerContext): 'en' | 'fr' | 'ar' {
  const code = (context.locale || 'en').toLowerCase().slice(0, 2);
  return code === 'fr' || code === 'ar' ? code : 'en';
}

function otherCategoryLabel(locale: 'en' | 'fr' | 'ar'): string {
  return locale === 'fr' ? 'Autre' : locale === 'ar' ? 'أخرى' : 'Other';
}

function contextTransactions(context: AiLedgerContext): LedgerTransaction[] {
  return (Array.isArray(context.txns) ? context.txns : [])
    .slice(0, AI_CONTEXT_TXN_LIMIT)
    .filter(
      (t) =>
        (t.type === 'income' || t.type === 'expense') &&
        Number.isFinite(t.amountMinor) &&
        t.amountMinor > 0 &&
        Number.isFinite(Date.parse(t.occurredAt)),
    )
    .map((t, i) => ({
      id: t.id || `ctx_${i}`,
      spaceId: context.spaceId,
      type: t.type,
      amountMinor: t.amountMinor,
      currency: context.currency,
      categoryId: t.categoryId,
      description: t.description ?? null,
      occurredAt: t.occurredAt,
      createdAt: t.occurredAt,
      createdBy: '',
      source: 'manual' as const,
      status: 'confirmed' as const,
    }));
}

function resolveChartKind(chartArg: string | undefined, focus: string): AiChartKind | null {
  if (chartArg === 'none') return null;
  if (chartArg === 'category' || chartArg === 'trend' || chartArg === 'hours') return chartArg;
  const f = focus.toLowerCase();
  if (/\b(hours?|time of day|heures?)\b|ساعة/.test(f)) return 'hours';
  if (/\b(trend|over time|vs|versus|compared|tendance)\b|اتجاه/.test(f)) return 'trend';
  // Income or spending reports → category breakdown (not the trend chart).
  return 'category';
}

function focusIsIncome(focus: string): boolean {
  return /\b(income|earn|salary|receiv|revenu|دخل|راتب)\b/i.test(focus);
}

function focusIsExpense(focus: string): boolean {
  return /\b(spend|expense|outgo|dépens|مصروف)\b/i.test(focus);
}

function trendLabel(isoDate: string, period: ReportPeriod, locale: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  const monthly = period === 'last3Months' || period === 'thisYear' || period === 'allTime';
  try {
    return monthly
      ? d.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
      : d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return isoDate.slice(0, 10);
  }
}

function runReport(
  context: AiLedgerContext,
  args: Record<string, unknown>,
  actions: AiAction[],
): { ok: true; result: Record<string, unknown> } {
  const focus = asString(args.focus) ?? 'overview';
  const periodRaw = asString(args.period) as ReportPeriod | undefined;
  const period: ReportPeriod =
    periodRaw && REPORT_PERIODS.includes(periodRaw) ? periodRaw : 'thisMonth';
  const locale = uiLocale(context);
  const currency = context.currency;
  const txns = contextTransactions(context);
  const hasSeries = txns.length > 0;

  const nameFor = (categoryId: string | null) => {
    const name = categoryId ? context.categories.find((c) => c.id === categoryId)?.name : null;
    return (name && (stripCategoryEmoji(name).trim() || name)) || otherCategoryLabel(locale);
  };
  const major = (minor: number) => majorFromMinor(minor, currency);

  const snap = hasSeries
    ? reportSnapshot(txns, currency, period, nameFor, { timeZone: context.timeZone })
    : null;
  const totals = snap?.totals ?? context.totals;
  const scoped = hasSeries ? filterTransactionsByPeriod(txns, period) : [];
  const incomeCategories = hasSeries
    ? categoryBreakdown(scoped, currency, nameFor, 'income')
    : [];
  const topIncome = incomeCategories[0] ?? null;
  const incomeFocus = focusIsIncome(focus);
  const expenseFocus = focusIsExpense(focus);

  const body = buildHumanReportBody({
    spaceName: context.spaceName,
    currency,
    periodLabel: snap ? PERIOD_LABEL[period] : undefined,
    focus,
    totals,
    topCategory: snap?.topCategory ?? null,
    topIncome,
    recent: context.recent,
  });

  const title = incomeFocus
    ? `${PERIOD_TITLE[period]} · income`
    : expenseFocus
      ? `${PERIOD_TITLE[period]} · spending`
      : focus === 'overview' || focus.length > 24
        ? PERIOD_TITLE[period]
        : focus.slice(0, 48);

  actions.push({
    type: 'report',
    title,
    body,
  });

  if (!snap) {
    return {
      ok: true,
      result: {
        focus,
        summary: body,
        seriesAvailable: false,
        note: 'No transaction series available — only overall totals and recent entries.',
      },
    };
  }

  // Structured series for the model + chart payload for the UI.
  const expenseCats = snap.categories.map((c) => ({
    name: c.name,
    amount: major(c.amountMinor),
    sharePct: Math.round(c.share * 100),
  }));
  const incomeCats = incomeCategories.map((c) => ({
    name: c.name,
    amount: major(c.amountMinor),
    sharePct: Math.round(c.share * 100),
  }));
  const trend = snap.trend.slice(-12).map((p) => ({
    date: p.date,
    income: major(p.incomeMinor),
    expense: major(p.expenseMinor),
  }));
  const peakHours = [...snap.hours]
    .filter((h) => h.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, amount: major(h.amountMinor), count: h.count }));

  const chart = resolveChartKind(asString(args.chart), focus);
  let points: AiChartPoint[] = [];
  if (chart === 'category') {
    const source = incomeFocus ? incomeCategories : snap.categories;
    const top = source.slice(0, 6);
    const rest = source.slice(6).reduce((sum, c) => sum + c.amountMinor, 0);
    points = top.map((c) => ({ label: c.name, valueMinor: c.amountMinor }));
    if (rest > 0) points.push({ label: otherCategoryLabel(locale), valueMinor: rest });
  } else if (chart === 'trend') {
    points = snap.trend.slice(-14).map((p) => ({
      label: trendLabel(p.date, period, locale),
      valueMinor: p.expenseMinor,
      incomeMinor: p.incomeMinor,
    }));
  } else if (chart === 'hours') {
    points = snap.hours
      .filter((h) => h.amountMinor > 0)
      .map((h) => ({ label: String(h.hour).padStart(2, '0'), valueMinor: h.amountMinor }));
  }
  const hasData = points.some((p) => p.valueMinor > 0 || (p.incomeMinor ?? 0) > 0);
  if (chart && hasData) {
    actions.push({ type: 'show_chart', chart, currency, points });
  }

  return {
    ok: true,
    result: {
      focus,
      period,
      currency,
      seriesAvailable: true,
      totals: {
        income: major(totals.incomeMinor),
        expense: major(totals.expenseMinor),
        net: major(totals.netMinor),
      },
      avgDailyExpense: major(snap.avgDailyExpenseMinor),
      topCategory: snap.topCategory
        ? {
            name: snap.topCategory.name,
            amount: major(snap.topCategory.amountMinor),
            sharePct: Math.round(snap.topCategory.share * 100),
          }
        : null,
      topIncome: topIncome
        ? {
            name: topIncome.name,
            amount: major(topIncome.amountMinor),
            sharePct: Math.round(topIncome.share * 100),
          }
        : null,
      categories: expenseCats.slice(0, 6),
      incomeCategories: incomeCats.slice(0, 6),
      insightHint: incomeFocus
        ? 'Talk about income sources (incomeCategories / topIncome). Do not lead with biggest spend.'
        : expenseFocus
          ? 'Talk about spending categories. Mention income only as context.'
          : 'Give one clear insight — do not dump every line.',
      trend,
      peakHours,
      chartShown: chart && hasData ? chart : null,
      summary: body,
      recent: context.recent.slice(0, 5).map((r) => formatRecentEntryHuman(r, currency)),
    },
  };
}

function runAnalyzeCategory(
  context: AiLedgerContext,
  args: Record<string, unknown>,
  actions: AiAction[],
): { ok: true; result: Record<string, unknown> } | { ok: false; error: string } {
  const query = asString(args.query);
  if (!query) return { ok: false, error: 'query is required' };
  const periodRaw = asString(args.period) as ReportPeriod | undefined;
  const period: ReportPeriod =
    periodRaw && REPORT_PERIODS.includes(periodRaw) ? periodRaw : 'thisMonth';
  const currency = context.currency;
  const q = normalizeCategoryQuery(query);

  const matchedCats = context.categories.filter((c) => {
    const n = normalizeCategoryQuery(c.name);
    return n === q || n.includes(q) || q.includes(n);
  });

  const matches = findRecentMatches(context, { query, period });
  // Prefer rows whose category matched; if categories matched by id, include those too.
  const matchedIds = new Set(matchedCats.map((c) => c.id));
  const byCatId = matchedIds.size
    ? searchableEntries(context).filter((r) => r.categoryId && matchedIds.has(r.categoryId))
    : [];
  let periodScoped = byCatId.length ? byCatId : matches;
  if (period !== 'allTime' && byCatId.length) {
    const asTxn = byCatId.map((r) => ({
      id: r.id,
      spaceId: context.spaceId,
      type: r.type as LedgerTransaction['type'],
      amountMinor: r.amountMinor,
      currency,
      categoryId: r.categoryId,
      description: r.description,
      occurredAt: r.occurredAt,
      createdAt: r.occurredAt,
      createdBy: '',
      source: 'manual' as const,
      status: 'confirmed' as const,
    }));
    const scoped = new Set(filterTransactionsByPeriod(asTxn, period).map((t) => t.id));
    periodScoped = byCatId.filter((r) => scoped.has(r.id));
  }

  let incomeMinor = 0;
  let expenseMinor = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const r of periodScoped) {
    if (r.type === 'income') {
      incomeMinor += r.amountMinor;
      incomeCount += 1;
    } else if (r.type === 'expense') {
      expenseMinor += r.amountMinor;
      expenseCount += 1;
    }
  }
  const netMinor = incomeMinor - expenseMinor;
  const meaning =
    netMinor > 0 ? 'won' : netMinor < 0 ? 'lost' : 'even';

  const samples = periodScoped
    .slice()
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 8)
    .map((r) => formatRecentEntryHuman(r, currency));

  const body = [
    `${stripCategoryEmoji(query).trim() || query} · ${PERIOD_LABEL[period]}`,
    `Received ${formatMinor(incomeMinor, currency)} (${incomeCount} entries) · spent ${formatMinor(expenseMinor, currency)} (${expenseCount} entries)`,
    netMinor === 0
      ? 'Net: even'
      : `Net: ${formatMinor(Math.abs(netMinor), currency)} ${meaning}`,
    samples.length ? `Sample: ${samples.join('; ')}` : 'No matching entries in this period.',
  ].join('\n');

  actions.push({
    type: 'report',
    title: `${stripCategoryEmoji(query).trim() || query} · ${PERIOD_TITLE[period]}`,
    body,
  });

  return {
    ok: true,
    result: {
      query,
      period,
      currency,
      matchedCategories: matchedCats.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      income: {
        count: incomeCount,
        amount: majorFromMinor(incomeMinor, currency),
        formatted: formatMinor(incomeMinor, currency),
      },
      expense: {
        count: expenseCount,
        amount: majorFromMinor(expenseMinor, currency),
        formatted: formatMinor(expenseMinor, currency),
      },
      net: {
        amount: majorFromMinor(netMinor, currency),
        formatted: formatMinor(netMinor, currency),
        meaning,
      },
      entryCount: periodScoped.length,
      samples,
      summary: body,
      insightHint:
        'Use income.count/expense.count and net.meaning. Never claim there are only 1–2 entries if entryCount is higher.',
    },
  };
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
      const periodRaw = asString(args.period) as ReportPeriod | undefined;
      const period =
        periodRaw && REPORT_PERIODS.includes(periodRaw) ? periodRaw : undefined;
      const allMatches = findRecentMatches(context, {
        query: asString(args.query),
        amount: asNumber(args.amount),
        type: asString(args.type),
        period,
      });
      let incomeMinor = 0;
      let expenseMinor = 0;
      for (const m of allMatches) {
        if (m.type === 'income') incomeMinor += m.amountMinor;
        else if (m.type === 'expense') expenseMinor += m.amountMinor;
      }
      const samples = allMatches.slice(0, 20);
      return {
        ok: true,
        result: {
          count: allMatches.length,
          truncated: allMatches.length > samples.length,
          period: period ?? 'allTime',
          incomeTotal: majorFromMinor(incomeMinor, context.currency),
          expenseTotal: majorFromMinor(expenseMinor, context.currency),
          netTotal: majorFromMinor(incomeMinor - expenseMinor, context.currency),
          entries: samples.map((m) => ({
            id: m.id,
            type: m.type,
            amount: majorFromMinor(m.amountMinor, context.currency),
            currency: context.currency,
            category: m.category,
            note: m.description,
            occurredAt: m.occurredAt,
          })),
          insightHint:
            'Totals cover every match (count). Samples may be truncated — never say there are only as many entries as the sample list.',
        },
      };
    }
    case 'analyze_category': {
      return runAnalyzeCategory(context, args, actions);
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
      const rawCategory = asString(args.category);
      const note = asString(args.note);
      const when = asString(args.when);

      if (!rawCategory) {
        return queueAskCategory(actions, context, entryType, amount, when, [], note);
      }

      const mapped =
        matchDefaultCategoryHint(rawCategory, entryType) ??
        stripCategoryEmoji(rawCategory) ??
        rawCategory;
      const category = mapped;

      const existing = context.categories.find(
        (c) =>
          c.type === entryType &&
          (stripCategoryEmoji(c.name).toLowerCase() === category.toLowerCase() ||
            c.name.toLowerCase() === category.toLowerCase() ||
            c.name.toLowerCase() === rawCategory.toLowerCase()),
      );
      if (!existing) {
        // Prefer mapping onto a default name rather than inventing a near-duplicate.
        const looksDefault = Boolean(matchDefaultCategoryHint(category, entryType));
        if (!looksDefault) {
          actions.push({ type: 'create_category', name: category, categoryType: entryType });
        }
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
          categories: context.categories.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          })),
          note: 'Same display name can exist twice (income + expense). Use analyze_category to compare them.',
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
            durationUnit: r.durationUnit ?? 'forever',
            durationCount: r.durationCount ?? null,
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
      const duration = normalizeRecurringDuration(
        asString(args.durationUnit) || undefined,
        asNumber(args.durationCount),
      );
      if (duration.ok === false) return { ok: false, error: duration.error };
      actions.push({
        type: 'create_recurring',
        name: nameValue,
        amountMajor: amount,
        kind,
        dayOfMonth,
        durationUnit: duration.value.durationUnit,
        durationCount: duration.value.durationCount,
      });
      return {
        ok: true,
        result: {
          queued: true,
          name: nameValue,
          amount,
          kind,
          dayOfMonth,
          durationUnit: duration.value.durationUnit,
          durationCount: duration.value.durationCount,
        },
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
      const durationUnitRaw = asString(args.durationUnit);
      const durationCountRaw = asNumber(args.durationCount);
      let durationUnit: 'forever' | 'months' | 'years' | undefined;
      let durationCount: number | null | undefined;
      if (durationUnitRaw !== undefined || durationCountRaw !== null) {
        // Fall back to the item's current unit when only the count is given.
        const current = (context.recurring ?? []).find((r) => r.id === resolved.recurringId);
        const duration = normalizeRecurringDuration(
          durationUnitRaw ?? current?.durationUnit ?? 'forever',
          durationCountRaw ?? (durationUnitRaw ? null : (current?.durationCount ?? null)),
        );
        if (duration.ok === false) return { ok: false, error: duration.error };
        durationUnit = duration.value.durationUnit;
        durationCount = duration.value.durationCount;
      }
      if (
        !nameValue &&
        amount == null &&
        !kind &&
        dayRaw == null &&
        active === undefined &&
        durationUnit === undefined
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
        durationUnit,
        durationCount,
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
      const typeRaw = asString(args.type) ?? 'shared';
      const allowed = [
        'personal',
        'household',
        'shared',
        'project',
        'family',
        'company',
      ] as const;
      type SpaceType = (typeof allowed)[number];
      const spaceType: SpaceType = (allowed as readonly string[]).includes(typeRaw)
        ? (typeRaw as SpaceType)
        : 'shared';
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
      return runReport(context, args, actions);
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
  const locale = (context.locale || 'en').toLowerCase().slice(0, 2);
  const replyLang =
    locale === 'fr' ? 'French' : locale === 'ar' ? 'Arabic' : 'English';

  // Compact snapshot — host models often load with a ~2k context window.
  const catNames = (context.categories ?? [])
    .slice(0, 20)
    .map((c) => c.name)
    .join(', ');
  const recentLines = (context.recent ?? [])
    .slice(0, 5)
    .map(
      (r) =>
        `- ${r.type} ${formatMinor(r.amountMinor, context.currency)}${r.category ? ` · ${r.category}` : ''}${r.description ? ` “${String(r.description).slice(0, 32)}”` : ''}`,
    )
    .join('\n');
  const goalLines = (context.goals ?? [])
    .slice(0, 4)
    .map(
      (g) =>
        `- "${g.name}" ${formatMinor(g.savedMinor, context.currency)}/${formatMinor(g.targetMinor, context.currency)}`,
    )
    .join('\n');

  return [
    // Persona
    'You are Penny — calm AI money companion inside the MoneyMap app. Speak in first person as Penny only.',
    'Tone: warm, practical, lightly funny — at most one short quip. Write like a short text to a friend: plain words only.',
    'FORMATTING: Never use markdown (no **, __, # headings, - bullet lists, numbered dumps, or code). Never show database ids (txn_…, goal_…, cat_…). Never paste or restate the whole report card — the app already shows it. One insight + one soft question is enough (1–3 short sentences). Never emit thinking tags (</think>, <think>), never emoji spam, never duplicate your answer.',
    'Greetings or small talk: one short friendly line, then offer help — do not reply with the same canned sentence every time. No tools for pure greetings.',
    'If the user says you are wrong or that there are more entries, call analyze_category or find_entries again over allTime / thisMonth — never insist on the previous incomplete count.',
    'Merchant / note questions (“how much on coffee”, “chamli”) → find_entries with that query (and period). Use the returned count + expenseTotal, not memory.',
    // Locale
    `LANGUAGE: Reply entirely in ${replyLang} (app locale "${locale}"), including category names and chart/report wording. Only switch if the user clearly writes in another language. Tool arguments stay in the user's own wording.`,
    `Currency is ${context.currency} — never assume USD and never write "$" unless ${context.currency} is USD. Amounts without a foreign ISO code (including local shorthand like DT/dnt/dinar for TND) are already in ${context.currency}; only convert_currency when a different ISO code is named.`,
    // When to use tools
    'Use tools for every ledger mutation and every number you report. Never say saved/created/deleted/updated/done unless the matching tool was called this turn.',
    'No category → ask_for_category (chips). Clear category → add_expense/add_income with a default label (Groceries, Food & Drinks, Housing, Bills, Transport, Shopping, Entertainment, Health, Education, Travel, Gifts, Family, Loans & Debts, Other). If the user answers a category question with a short word, reuse the amount from the previous message — do not ask for the amount again.',
    'Notes optional — do not ask for a note after saving unless the user asked.',
    'Overall spending/income/trend/hour questions → get_report (set focus=expenses|income|trend|hours and period). Income reports must use incomeCategories/topIncome — never reuse the biggest-spend line. Never invent amounts.',
    'Named category P&L (Sponsore, difference, won/lost, income vs spend for one label, two categories with the same name) → analyze_category with that query + period. Trust entryCount/income.count/expense.count from the tool — never claim only 1–2 entries if count is higher. find_entries is for locating rows to edit/delete, not for category totals.',
    'Goal progress → list_goals first. Recurring items → list_recurring first. Unsure which entry/category/goal → find_entries / list_categories / list_goals, then act.',
    // Visuals
    'get_report draws the chart: category for spend or income sources, trend for over-time income vs spend, hours for time-of-day. One insight in 1–2 sentences; the card already shows the numbers.',
    'Recommendations: use get_report or analyze_category first, then suggest one concrete next step (rename category, set a goal, cut a top spend). Never invent merchants or fake counts.',
    'Do not describe app screens you are unsure of; the tabs are Home, Activity, Goals, Reports.',
    // Safety
    'If the message is gibberish, a lone word, or unclear, ask one short clarifying question and call no tools. Never call delete/hide/update tools on unclear input or on short replies like "yes", "ok", "both", "any".',
    'Delete/hide ONLY when the user clearly says delete/remove/undo/hide AND names what (the last entry, a specific category, goal, or recurring item). Never bulk-delete: if asked to remove several or "all/most" items, list the candidates and ask which one first, then delete one at a time.',
    'Prefer ids from find_entries/list_* for tool calls only — never read ids aloud to the user. If a tool returns needDisambiguation or an error, tell the user in plain language and ask — never claim success.',
    'No investment, tax, or lending advice.',
    `Active space: ${context.spaceName}. Currency: ${context.currency}.`,
    `Categories: ${catNames || 'none yet'}.`,
    `Totals — income ${formatMinor(context.totals.incomeMinor, context.currency)}, expenses ${formatMinor(context.totals.expenseMinor, context.currency)}, net ${formatMinor(context.totals.netMinor, context.currency)}.`,
    recentLines ? `Recent:\n${recentLines}` : 'Recent: none.',
    goalLines ? `Goals:\n${goalLines}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
