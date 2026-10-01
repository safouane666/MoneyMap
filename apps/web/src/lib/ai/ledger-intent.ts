import { currencyDecimalPlaces } from '@clear-money/domain';
import { buildCategorySuggestions, runAiTool } from './tools';
import type { AiAction, AiLedgerContext } from './types';

const ISO_CODE = /\b([A-Z]{3})\b/;

export type MoneyDraft = {
  entryType: 'expense' | 'income';
  amount: number;
  currencyCode?: string;
  categoryHint?: string;
  note?: string;
};

/** Rough spend / income / category intents when the model skips tools. */
export function looksLikeLedgerIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /\b(spent|spend|paid|pay|bought|cost|costs|expense|expenses)\b/i.test(t) &&
    /\d/.test(t)
  ) {
    return true;
  }
  if (
    /\b(received|receive|earned|earning|income|got paid|salary)\b/i.test(t) &&
    /\d/.test(t)
  ) {
    return true;
  }
  if (/\bcreate\b.+\bcategor(?:y|ies)\b/i.test(t) || /\bnew\b.+\bcategor(?:y|ies)\b/i.test(t)) {
    return true;
  }
  if (/\b(how much|summary|summarize|report|balance|totals?)\b/i.test(t)) {
    return true;
  }
  if (
    /\b(delete|remove|undo|hide)\b.+\b(expense|income|entry|transaction|spend|last)\b/i.test(t) ||
    /\b(delete|remove|undo|hide)\b.+\blast\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(goal|save for|savings)\b/i.test(t)) return true;
  if (/\b(salary|subscription|recurring|bill)\b/i.test(t)) return true;
  if (/\b(create|switch|new)\b.+\bspace\b/i.test(t) || /\binvite\b.+\b@/i.test(t)) return true;
  // Affirmations after a pending save ("yes", "add it once more")
  if (/^(yes|yeah|yep|ok|okay|sure|confirm|do it|save it|add it(?: once more)?)\b/i.test(t)) {
    return true;
  }
  return false;
}

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function titleCaseName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w === '&') return '&';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function extractEmbeddedNote(text: string): { body: string; note?: string } {
  const m =
    text.match(/,\s*note(?:\s+it)?(?:\s+as)?\s+(.+)$/i) ||
    text.match(/\bnote(?:\s+it)?(?:\s+as)?[:\s]+(.+)$/i);
  if (!m || m.index == null) return { body: text.trim() };
  return {
    body: text.slice(0, m.index).trim().replace(/[,\s]+$/, ''),
    note: m[1].trim().replace(/[?.!,]+$/g, ''),
  };
}

function extractCategoryHint(tail: string | undefined): string | undefined {
  if (!tail) return undefined;
  let t = tail
    .replace(/\b(today|yesterday|just now|this morning|tonight)\b/gi, '')
    .replace(/[?.!,]+$/g, '')
    .trim();
  t = t.replace(/^(on|for|at|to|in)\s+/i, '').trim();
  if (!t || t.length > 40) return undefined;
  t = t.replace(/^(a|an|the)\s+/i, '').trim();
  if (!t) return undefined;
  // Normalize common places
  if (/^restaurants?$/i.test(t)) return 'Food & Restaurants';
  if (/^coffees?$/i.test(t)) return 'Coffee';
  return titleCaseName(t);
}

export function parseCreateCategory(text: string): { name: string; type: 'expense' | 'income' } | null {
  const m =
    text.match(
      /\b(?:create|add|make)\s+(?:an?\s+)?(?:new\s+)?(?:(expense|income)\s+)?categor(?:y|ies)\s+(?:called\s+|named\s+|for\s+)?["']?([^"'?.!,]+)["']?/i,
    ) ||
    text.match(
      /\b(?:create|add|make)\s+(?:an?\s+)?["']?([^"'?.!,]+?)["']?\s+categor(?:y|ies)\b/i,
    );
  if (!m) return null;
  if (m.length >= 3 && m[2]) {
    const type = m[1]?.toLowerCase() === 'income' ? 'income' : 'expense';
    const name = m[2].trim().replace(/^(a|an|the)\s+/i, '');
    if (!name) return null;
    return { type, name: titleCaseName(name) };
  }
  const name = (m[1] ?? '').trim().replace(/^(a|an|the)\s+/i, '');
  if (!name) return null;
  return { type: 'expense', name: titleCaseName(name) };
}

function currencyFromMatch(symbol: string | undefined, code: string | undefined): string | undefined {
  const c = code?.toUpperCase();
  if (c) return c;
  if (symbol === '$') return 'USD';
  if (symbol === '€') return 'EUR';
  if (symbol === '£') return 'GBP';
  return undefined;
}

/**
 * Parse spend/income utterances. Supports:
 * - "I spent 42TND in a restaurant, note it as date with Baby"
 * - "I spent 12.50 on coffee"
 * - "paid 10 EUR for lunch"
 */
export function parseMoneyUtterance(text: string): MoneyDraft | null {
  const { body, note } = extractEmbeddedNote(text);

  const spend =
    body.match(
      /\b(?:i\s+)?(?:also\s+)?(?:just\s+)?(?:spent|spend|paid|pay|bought)\s+(?:about\s+|around\s+)?(?:([$€£])\s*)?([\d.,]+)(?:\s*([A-Za-z]{3})\b)?(?:\s+(?:on|for|at|in)\s+(.+))?/i,
    ) ||
    body.match(
      /\b(?:expense|cost)\s+(?:of\s+)?(?:([$€£])\s*)?([\d.,]+)(?:\s*([A-Za-z]{3})\b)?(?:\s+(?:on|for|at|in)\s+(.+))?/i,
    );

  if (spend) {
    const amount = parseAmountToken(spend[2] ?? '');
    if (amount == null) return null;
    return {
      entryType: 'expense',
      amount,
      currencyCode: currencyFromMatch(spend[1], spend[3]),
      categoryHint: extractCategoryHint(spend[4]),
      note,
    };
  }

  const income = body.match(
    /\b(?:i\s+)?(?:just\s+)?(?:received|receive|earned|got)\s+(?:about\s+|around\s+)?(?:([$€£])\s*)?([\d.,]+)(?:\s*([A-Za-z]{3})\b)?(?:\s+(?:from|for|as)\s+(.+))?/i,
  );
  if (income) {
    const amount = parseAmountToken(income[2] ?? '');
    if (amount == null) return null;
    return {
      entryType: 'income',
      amount,
      currencyCode: currencyFromMatch(income[1], income[3]),
      categoryHint: extractCategoryHint(income[4]),
      note,
    };
  }

  const bare = body.match(
    /^(?:([$€£])\s*)?([\d.,]+)(?:\s*([A-Za-z]{3})\b)?\s+(?:on\s+|for\s+|at\s+|in\s+)?(.+)$/i,
  );
  if (bare && !/\?/.test(body)) {
    const amount = parseAmountToken(bare[2] ?? '');
    if (amount == null) return null;
    return {
      entryType: 'expense',
      amount,
      currencyCode: currencyFromMatch(bare[1], bare[3]),
      categoryHint: extractCategoryHint(bare[4]),
      note,
    };
  }

  return null;
}

function majorFromMinor(amountMinor: number, currency: string): number {
  const decimals = currencyDecimalPlaces(currency);
  return amountMinor / 10 ** decimals;
}

export { majorFromMinor };

function hasMoneyEntryAction(actions: AiAction[]): boolean {
  return actions.some((a) => a.type === 'ask_category' || a.type === 'add_transaction');
}

async function queueMoneyFromDraft(
  money: MoneyDraft,
  context: AiLedgerContext,
  actions: AiAction[],
  forceCategory?: string,
): Promise<boolean> {
  if (hasMoneyEntryAction(actions)) return false;

  let amount = money.amount;
  let note = money.note;
  const mentioned = money.currencyCode?.toUpperCase();
  if (mentioned && mentioned !== context.currency.toUpperCase()) {
    const converted = await runAiTool(
      'convert_currency',
      { amount, from: mentioned, to: context.currency },
      context,
      actions,
    );
    if (converted.ok && typeof converted.result.converted === 'number') {
      amount = converted.result.converted;
      const fxHint =
        typeof converted.result.noteHint === 'string'
          ? converted.result.noteHint
          : `${money.amount} ${mentioned}`;
      note = note ? `${note} (${fxHint})` : fxHint;
    }
  }

  const hint = forceCategory ?? money.categoryHint;
  if (hint) {
    await runAiTool(
      money.entryType === 'income' ? 'add_income' : 'add_expense',
      { amount, category: hint, note },
      context,
      actions,
    );
  } else {
    await runAiTool(
      'ask_for_category',
      {
        amount,
        type: money.entryType,
        hints: [],
        note,
      },
      context,
      actions,
    );
  }

  if (!hasMoneyEntryAction(actions)) {
    const suggestions = buildCategorySuggestions(context, money.entryType, hint ? [hint] : []);
    actions.push({
      type: 'ask_category',
      entryType: money.entryType,
      amountMajor: amount,
      suggestions,
      note,
    });
  }

  return hasMoneyEntryAction(actions);
}

/**
 * If the model replied with plain chat and no ledger tools, synthesize the usual tool
 * effects so category chips / creates / entries still happen.
 *
 * @param openDraft — unfinished spend from an earlier turn (category not chosen yet)
 */
export async function applyDeterministicLedgerFallback(
  userText: string,
  context: AiLedgerContext,
  actions: AiAction[],
  openDraft?: MoneyDraft | null,
): Promise<boolean> {
  const create = parseCreateCategory(userText);
  if (create) {
    if (
      !actions.some(
        (a) => a.type === 'create_category' && a.name.toLowerCase() === create.name.toLowerCase(),
      )
    ) {
      await runAiTool(
        'create_category',
        { name: create.name, type: create.type },
        context,
        actions,
      );
    }
    // Completing an open spend with the new category — this is the missing piece.
    if (openDraft && !hasMoneyEntryAction(actions)) {
      await queueMoneyFromDraft(
        { ...openDraft, entryType: create.type || openDraft.entryType },
        context,
        actions,
        create.name,
      );
    }
    return hasMoneyEntryAction(actions) || actions.some((a) => a.type === 'create_category');
  }

  if (/^(yes|yeah|yep|ok|okay|sure|confirm|do it|save it|add it(?: once more)?)\b/i.test(userText.trim())) {
    if (openDraft && openDraft.categoryHint && !hasMoneyEntryAction(actions)) {
      return queueMoneyFromDraft(openDraft, context, actions, openDraft.categoryHint);
    }
  }

  if (/\b(how much|summary|summarize|report|balance|totals?)\b/i.test(userText)) {
    if (!actions.some((a) => a.type === 'report')) {
      await runAiTool('get_report', { focus: 'overview' }, context, actions);
    }
    return actions.some((a) => a.type === 'report');
  }

  const money = parseMoneyUtterance(userText);
  if (!money) {
    // Retry save of open draft when user insists ("can't see it, add it once more")
    if (
      openDraft &&
      openDraft.categoryHint &&
      /\b(add|save|log|again|once more|still|can't see|cannot see)\b/i.test(userText) &&
      !hasMoneyEntryAction(actions)
    ) {
      return queueMoneyFromDraft(openDraft, context, actions, openDraft.categoryHint);
    }
    return false;
  }

  return queueMoneyFromDraft(money, context, actions);
}

export function extractIsoCurrencyMention(text: string): string | undefined {
  const m = text.toUpperCase().match(ISO_CODE);
  return m?.[1];
}

export function claimsLedgerSaved(text: string): boolean {
  return /\b(added|logged|saved|recorded|entry has been saved|has been saved|put it in|filed)\b/i.test(
    text,
  );
}
