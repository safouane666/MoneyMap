import { currencyDecimalPlaces } from '@clear-money/domain';
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
        'Update a past entry note and/or category. Prefer transactionId from find_entries or recent context. Can also match the latest similar entry.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          query: { type: 'string', description: 'Fallback search text if id unknown' },
          matchAmount: { type: 'number', description: 'Fallback major-unit amount match' },
          newNote: { type: 'string', description: 'Replacement note/description' },
          newCategory: { type: 'string', description: 'Replacement category name' },
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
      if (!newNote && !newCategory) {
        return { ok: false, error: 'Provide newNote and/or newCategory' };
      }

      let transactionId = asString(args.transactionId);
      if (!transactionId) {
        const matches = findRecentMatches(context, {
          query: asString(args.query),
          amount: asNumber(args.matchAmount),
        });
        if (matches.length === 0 && context.recent[0]) {
          // default to most recent when user says "the last activity"
          const q = asString(args.query)?.toLowerCase();
          if (!q || q.includes('last') || q.includes('latest') || q.includes('recent')) {
            transactionId = context.recent[0].id;
          }
        } else if (matches.length === 1) {
          transactionId = matches[0]!.id;
        } else if (matches.length > 1) {
          return {
            ok: true,
            result: {
              needDisambiguation: true,
              matches: matches.map((m) => ({
                id: m.id,
                note: m.description,
                category: m.category,
                amount: majorFromMinor(m.amountMinor, context.currency),
              })),
            },
          };
        }
      }

      // “last activity” / “change the note” with no match → newest
      if (!transactionId && context.recent[0]) {
        transactionId = context.recent[0].id;
      }

      if (!transactionId) {
        return { ok: false, error: 'Could not find an entry to update' };
      }

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
      });

      return {
        ok: true,
        result: {
          queued: true,
          transactionId,
          newNote: newNote ?? null,
          newCategory: newCategory ?? null,
        },
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
    case 'list_categories': {
      return {
        ok: true,
        result: {
          categories: context.categories.map((c) => ({ name: c.name, type: c.type })),
        },
      };
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

  return [
    'You are Penny — Clear Money’s companion: a calm gold-coin guide with a soft indigo orbit vibe.',
    'Always speak in first person as Penny. Never call yourself “the assistant”, “an AI”, or “a chatbot”.',
    'If asked who you are: you’re Penny, the Clear Money companion who helps log spend/income, tidy categories, convert currencies, and explain reports — jokes light, ledger honest.',
    'Tone: warm, sharp, lightly funny. Dry humor about money is welcome, but never spam jokes — at most one short quip when it fits.',
    'Keep answers concise and conversational, like a coach sitting next to the ledger — not a corporate FAQ.',
    'Help register spend/receive, create categories, edit past notes, convert currencies, and explain reports.',
    'CRITICAL — ledger actions MUST use tools. Never pretend you saved, created, or converted something without a tool call.',
    'CRITICAL money entry flow:',
    `1) Amounts without an explicit foreign currency code are already in ${context.currency}. Do NOT call convert_currency for them.`,
    `2) Only call convert_currency when the user names a currency code different from ${context.currency}.`,
    '3) If amount has no category, you MUST call ask_for_category (UI shows chips). Never ask for category in free text only.',
    '4) If category is already clear (e.g. “on coffee”), call add_expense/add_income with that category.',
    '5) When the user asks to create a category, call create_category — do not only acknowledge in chat.',
    '6) Notes are optional after save — do not block saving on a note.',
    'Editing past entries:',
    '- You CAN update notes and categories. Use find_entries and/or update_entry. Never say you lack this ability.',
    '- “Change the last activity note to …” → update_entry on the newest matching recent id.',
    'Use tools for ledger facts. Do not invent balances or FX rates.',
    `Amounts the ledger stores are in ${context.currency} major units.`,
    'No investment, tax, or lending advice.',
    `Active space: ${context.spaceName}. Currency: ${context.currency}. Always format money as ${context.currency}, never assume USD.`,
    `Categories: ${cats || 'none yet'}.`,
    `Current totals — income ${formatMinor(context.totals.incomeMinor, context.currency)}, expenses ${formatMinor(context.totals.expenseMinor, context.currency)}, net ${formatMinor(context.totals.netMinor, context.currency)}.`,
    recentLines ? `Recent entries:\n${recentLines}` : 'Recent entries: none.',
  ].join('\n');
}
