import { categoryChipParts } from '@clear-money/domain';
import { t } from './i18n';

/** Map stored English default names → stableKey when API omitted stableKey. */
function resolveStableKey(name: string, stableKey?: string | null): string | null {
  if (stableKey) return stableKey.toLowerCase();
  const raw = name.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '_');
  const aliases: Record<string, string> = {
    groceries: 'groceries',
    food_and_drinks: 'food_drinks',
    'food_&_drinks': 'food_drinks',
    housing: 'housing',
    bills: 'bills',
    transport: 'transport',
    shopping: 'shopping',
    entertainment: 'entertainment',
    health: 'health',
    education: 'education',
    travel: 'travel',
    gifts: 'gifts',
    family: 'family',
    loans_and_debts: 'loans_debts',
    other: 'other',
    salary: 'salary',
    freelance: 'freelance',
    bonus: 'bonus',
    gift_income: 'gift_income',
    other_income: 'other_income',
  };
  return aliases[raw] ?? null;
}

/** Resolve default category label for the active locale (custom names stay as stored). */
export function localizedCategoryLabel(
  locale: string,
  name: string,
  stableKey?: string | null,
): string {
  const parts = categoryChipParts(name, stableKey);
  const key = resolveStableKey(name, stableKey);
  if (key) {
    const i18nKey = `category.${key}`;
    const translated = t(locale, i18nKey);
    if (translated !== i18nKey) return translated;
  }
  return parts.label;
}

export function localizedCategoryChip(
  locale: string,
  name: string,
  stableKey?: string | null,
): { emoji: string; label: string } {
  const parts = categoryChipParts(name, stableKey);
  return {
    emoji: parts.emoji,
    label: localizedCategoryLabel(locale, name, stableKey),
  };
}

export function localizedCategoryDisplay(
  locale: string,
  name: string,
  stableKey?: string | null,
): string {
  const { emoji, label } = localizedCategoryChip(locale, name, stableKey);
  return emoji ? `${emoji} ${label}` : label;
}
