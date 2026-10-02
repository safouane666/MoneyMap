/** Built-in expense categories — global (spaceId null). Custom categories are always space-scoped. */

export type DefaultExpenseCategory = {
  stableKey: string;
  /** Short UI label without emoji */
  name: string;
  emoji: string;
  /** Hints Penny uses to auto-pick; never shown in the category chip UI */
  keywords: string[];
};

export const DEFAULT_EXPENSE_CATEGORIES: readonly DefaultExpenseCategory[] = [
  {
    stableKey: 'groceries',
    name: 'Groceries',
    emoji: '🛒',
    keywords: ['grocery', 'groceries', 'supermarket', 'market', 'food shop'],
  },
  {
    stableKey: 'food_drinks',
    name: 'Food & Drinks',
    emoji: '🍔',
    keywords: [
      'food',
      'drink',
      'drinks',
      'restaurant',
      'restaurants',
      'cafe',
      'café',
      'coffee',
      'delivery',
      'snack',
      'snacks',
      'lunch',
      'dinner',
      'breakfast',
    ],
  },
  {
    stableKey: 'housing',
    name: 'Housing',
    emoji: '🏠',
    keywords: ['housing', 'rent', 'mortgage', 'repair', 'repairs', 'home'],
  },
  {
    stableKey: 'bills',
    name: 'Bills',
    emoji: '💡',
    keywords: [
      'bill',
      'bills',
      'electricity',
      'water',
      'internet',
      'phone',
      'utilities',
      'subscription',
      'subscriptions',
    ],
  },
  {
    stableKey: 'transport',
    name: 'Transport',
    emoji: '🚗',
    keywords: [
      'transport',
      'fuel',
      'gas',
      'petrol',
      'taxi',
      'uber',
      'bus',
      'metro',
      'parking',
      'train',
    ],
  },
  {
    stableKey: 'shopping',
    name: 'Shopping',
    emoji: '🛍️',
    keywords: [
      'shopping',
      'clothes',
      'clothing',
      'electronics',
      'amazon',
      'online order',
      'online orders',
    ],
  },
  {
    stableKey: 'entertainment',
    name: 'Entertainment',
    emoji: '🎬',
    keywords: [
      'entertainment',
      'movie',
      'movies',
      'cinema',
      'game',
      'games',
      'hobby',
      'hobbies',
      'outing',
      'outings',
      'fun',
    ],
  },
  {
    stableKey: 'health',
    name: 'Health',
    emoji: '❤️',
    keywords: ['health', 'pharmacy', 'doctor', 'gym', 'medicine', 'dentist', 'hospital'],
  },
  {
    stableKey: 'education',
    name: 'Education',
    emoji: '📚',
    keywords: ['education', 'course', 'courses', 'book', 'books', 'school', 'tuition', 'fees'],
  },
  {
    stableKey: 'travel',
    name: 'Travel',
    emoji: '✈️',
    keywords: ['travel', 'flight', 'flights', 'hotel', 'hotels', 'trip', 'trips', 'vacation'],
  },
  {
    stableKey: 'gifts',
    name: 'Gifts',
    emoji: '🎁',
    keywords: ['gift', 'gifts', 'present', 'presents', 'donation', 'donations', 'celebration'],
  },
  {
    stableKey: 'family',
    name: 'Family',
    emoji: '👨‍👩‍👧',
    keywords: ['family', 'kids', 'kid', 'pet', 'pets', 'child', 'children'],
  },
  {
    stableKey: 'loans_debts',
    name: 'Loans & Debts',
    emoji: '💸',
    keywords: ['loan', 'loans', 'debt', 'debts', 'borrowed', 'lent', 'repayment', 'repayments'],
  },
  {
    stableKey: 'other',
    name: 'Other',
    emoji: '📦',
    keywords: ['other', 'misc', 'miscellaneous'],
  },
] as const;

export type DefaultIncomeCategory = {
  stableKey: string;
  name: string;
  emoji: string;
  keywords: string[];
};

export const DEFAULT_INCOME_CATEGORIES: readonly DefaultIncomeCategory[] = [
  {
    stableKey: 'salary',
    name: 'Salary',
    emoji: '💼',
    keywords: ['salary', 'paycheck', 'wage', 'wages', 'payroll'],
  },
  {
    stableKey: 'freelance',
    name: 'Freelance',
    emoji: '💻',
    keywords: ['freelance', 'client', 'contract', 'gig'],
  },
  {
    stableKey: 'bonus',
    name: 'Bonus',
    emoji: '✨',
    keywords: ['bonus', 'raise', 'commission'],
  },
  {
    stableKey: 'gift_income',
    name: 'Gift',
    emoji: '🎁',
    keywords: ['gift', 'gifts', 'present'],
  },
  {
    stableKey: 'other_income',
    name: 'Other',
    emoji: '📦',
    keywords: ['other', 'misc'],
  },
] as const;

export function categoryDisplayLabel(emoji: string, name: string): string {
  return `${emoji} ${name}`;
}

/** Strip leading emoji so matching works whether the stored name includes it or not. */
export function stripCategoryEmoji(name: string): string {
  return name
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '')
    .trim();
}

export function formatCategoryChip(name: string, stableKey?: string | null): string {
  const key = stableKey?.toLowerCase();
  const fromDefaults =
    DEFAULT_EXPENSE_CATEGORIES.find((c) => c.stableKey === key) ||
    DEFAULT_INCOME_CATEGORIES.find((c) => c.stableKey === key);
  if (fromDefaults) return categoryDisplayLabel(fromDefaults.emoji, fromDefaults.name);

  const stripped = stripCategoryEmoji(name);
  const byName =
    DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === stripped.toLowerCase()) ||
    DEFAULT_INCOME_CATEGORIES.find((c) => c.name.toLowerCase() === stripped.toLowerCase());
  if (byName) return categoryDisplayLabel(byName.emoji, byName.name);
  return name;
}

/** Split chip label into emoji + text for grid layouts (emoji left, label truncates). */
export function categoryChipParts(
  name: string,
  stableKey?: string | null,
): { emoji: string; label: string } {
  const key = stableKey?.toLowerCase();
  const fromDefaults =
    DEFAULT_EXPENSE_CATEGORIES.find((c) => c.stableKey === key) ||
    DEFAULT_INCOME_CATEGORIES.find((c) => c.stableKey === key);
  if (fromDefaults) return { emoji: fromDefaults.emoji, label: fromDefaults.name };

  const stripped = stripCategoryEmoji(name);
  const byName =
    DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === stripped.toLowerCase()) ||
    DEFAULT_INCOME_CATEGORIES.find((c) => c.name.toLowerCase() === stripped.toLowerCase());
  if (byName) return { emoji: byName.emoji, label: byName.name };

  const match = name.match(/^([\p{Extended_Pictographic}\uFE0F\u200D]+)\s*(.*)$/u);
  if (match?.[1]) {
    return { emoji: match[1], label: (match[2] || stripped || name).trim() };
  }
  return { emoji: '', label: stripped || name };
}

/** Map a free-text hint (e.g. "coffee") to a default category short name, if confident. */
export function matchDefaultCategoryHint(
  hint: string,
  type: 'expense' | 'income' = 'expense',
): string | undefined {
  const raw = stripCategoryEmoji(hint).toLowerCase().trim();
  if (!raw) return undefined;
  const catalog = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;

  for (const cat of catalog) {
    if (cat.name.toLowerCase() === raw || cat.stableKey.replace(/_/g, ' ') === raw) {
      return cat.name;
    }
  }
  for (const cat of catalog) {
    if (cat.keywords.some((k) => k === raw || raw.includes(k) || k.includes(raw))) {
      return cat.name;
    }
  }
  return undefined;
}

export function defaultCategoryRows(): Array<{
  id: string;
  stableKey: string;
  name: string;
  type: 'expense' | 'income';
}> {
  return [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      id: `cat_${c.stableKey}`,
      stableKey: c.stableKey,
      name: categoryDisplayLabel(c.emoji, c.name),
      type: 'expense' as const,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
      id: `cat_${c.stableKey}`,
      stableKey: c.stableKey,
      name: categoryDisplayLabel(c.emoji, c.name),
      type: 'income' as const,
    })),
  ];
}
