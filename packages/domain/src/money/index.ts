/** Integer minor-unit money. Never use floating point for arithmetic. */

export type CurrencyCode = string;

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

/** ISO 4217 decimal places for common and zero/three-decimal currencies. */
const DECIMAL_PLACES: Record<string, number> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function currencyDecimalPlaces(code: CurrencyCode): number {
  const upper = code.toUpperCase();
  return DECIMAL_PLACES[upper] ?? 2;
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error('amountMinor must be an integer');
  }
  return { amountMinor, currency: currency.toUpperCase() };
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sumMoney(items: Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, m) => addMoney(acc, m), money(0, currency));
}

export function absMoney(m: Money): Money {
  return money(Math.abs(m.amountMinor), m.currency);
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor - b.amountMinor;
}

/**
 * Evaluate a simple calculator expression (+ − × ÷). Supports `x`/`*` and `÷`/`/`.
 * Uses * / before + -; returns a plain decimal string (no trailing junk zeros beyond 6 places).
 */
export function evaluateAmountExpression(input: string): string {
  const normalized = input
    .trim()
    .replace(/,/g, '.')
    .replace(/[x×]/gi, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '');
  if (!normalized) throw new Error('Invalid amount');
  if (!/^-?[\d.]+(?:[+\-*/]-?[\d.]+)*$/.test(normalized)) {
    throw new Error('Invalid amount');
  }

  const tokens: Array<number | '+' | '-' | '*' | '/'> = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i]!;
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      // Unary minus / plus at start or after an operator
      if (
        (ch === '+' || ch === '-') &&
        (tokens.length === 0 || typeof tokens[tokens.length - 1] !== 'number')
      ) {
        let j = i + 1;
        while (j < normalized.length && /[\d.]/.test(normalized[j]!)) j += 1;
        const num = Number(normalized.slice(i, j));
        if (!Number.isFinite(num)) throw new Error('Invalid amount');
        tokens.push(num);
        i = j;
        continue;
      }
      tokens.push(ch);
      i += 1;
      continue;
    }
    let j = i;
    while (j < normalized.length && /[\d.]/.test(normalized[j]!)) j += 1;
    const num = Number(normalized.slice(i, j));
    if (!Number.isFinite(num)) throw new Error('Invalid amount');
    tokens.push(num);
    i = j;
  }

  const apply = (a: number, op: '+' | '-' | '*' | '/', b: number): number => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (b === 0) throw new Error('Cannot divide by zero');
    return a / b;
  };

  // * and / first
  const mulDiv: Array<number | '+' | '-'> = [];
  let idx = 0;
  while (idx < tokens.length) {
    const tok = tokens[idx]!;
    if (tok === '*' || tok === '/') {
      const left = mulDiv.pop();
      const right = tokens[idx + 1];
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new Error('Invalid amount');
      }
      mulDiv.push(apply(left, tok, right));
      idx += 2;
      continue;
    }
    if (tok === '+' || tok === '-') {
      mulDiv.push(tok);
      idx += 1;
      continue;
    }
    mulDiv.push(tok);
    idx += 1;
  }

  let result = mulDiv[0];
  if (typeof result !== 'number') throw new Error('Invalid amount');
  for (let k = 1; k < mulDiv.length; k += 2) {
    const op = mulDiv[k];
    const right = mulDiv[k + 1];
    if ((op !== '+' && op !== '-') || typeof right !== 'number') {
      throw new Error('Invalid amount');
    }
    result = apply(result, op, right);
  }

  if (!Number.isFinite(result)) throw new Error('Invalid amount');
  const rounded = Math.round(result * 1_000_000) / 1_000_000;
  return String(rounded);
}

/** Parse a display string into minor units using currency decimal places. No rounding of stored values. */
export function parseDisplayAmount(display: string, currency: CurrencyCode): number {
  const cleaned = display.replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') {
    throw new Error('Invalid amount');
  }
  const negative = cleaned.startsWith('-');
  const raw = negative ? cleaned.slice(1) : cleaned;
  const decimals = currencyDecimalPlaces(currency);
  const [wholePart, fracPart = ''] = raw.split('.');
  if (fracPart.length > decimals) {
    throw new Error(`Too many decimal places for ${currency}`);
  }
  const padded = fracPart.padEnd(decimals, '0');
  const minor = Number(wholePart || '0') * 10 ** decimals + Number(padded || '0');
  if (!Number.isInteger(minor)) {
    throw new Error('Invalid amount');
  }
  return negative ? -minor : minor;
}

/** Parse amount fields that may include a quick + − × ÷ expression. */
export function parseAmountInput(display: string, currency: CurrencyCode): number {
  const trimmed = display.trim();
  if (!trimmed) throw new Error('Invalid amount');
  const hasOps = /[+\-*/x×÷]/i.test(trimmed.slice(1)) || /[*/x×÷]/i.test(trimmed);
  if (hasOps || /[+\-]/.test(trimmed.slice(1))) {
    return parseDisplayAmount(evaluateAmountExpression(trimmed), currency);
  }
  return parseDisplayAmount(trimmed, currency);
}

export function formatMinorUnits(
  amountMinor: number,
  currency: CurrencyCode,
  locale: string,
): string {
  const decimals = currencyDecimalPlaces(currency);
  const major = amountMinor / 10 ** decimals;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major);
}

/** Full ISO 4217 catalog subset — all common codes plus zero/three-decimal currencies. */
export const CURRENCY_CATALOG: Array<{
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}> = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', decimals: 3 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', decimals: 3 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimals: 3 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0 },
];
