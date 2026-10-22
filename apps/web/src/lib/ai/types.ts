export type AiChatRole = 'user' | 'assistant' | 'system';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiLedgerContext {
  currency: string;
  spaceName: string;
  spaceId: string;
  /** UI language (en | fr | ar) — Penny must reply in this language. */
  locale?: string;
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>;
  totals: {
    incomeMinor: number;
    expenseMinor: number;
    netMinor: number;
  };
  recent: Array<{
    id: string;
    type: string;
    amountMinor: number;
    description: string | null;
    category: string | null;
    occurredAt: string;
  }>;
  /** Active-space goals (Penny can create / update / delete). */
  goals?: Array<{
    id: string;
    name: string;
    targetMinor: number;
    savedMinor: number;
    durationMonths: number;
    status: string;
    paceStatus?: string | null;
  }>;
  /** Active-space recurring income/expenses. */
  recurring?: Array<{
    id: string;
    name: string;
    amountMinor: number;
    kind: 'income' | 'expense';
    dayOfMonth: number;
    active: boolean;
    durationUnit?: 'forever' | 'months' | 'years';
    durationCount?: number | null;
  }>;
  /** Spaces the user can switch between. */
  spaces?: Array<{ id: string; name: string; currency: string }>;
  /** IANA time zone of the device (used for hour-of-day charts). */
  timeZone?: string;
  /**
   * Compact income/expense rows (newest first, capped by the client) so get_report can
   * build category / trend / hour series with the shared domain helpers.
   */
  txns?: AiContextTxn[];
}

export interface AiContextTxn {
  type: 'income' | 'expense';
  amountMinor: number;
  categoryId: string | null;
  occurredAt: string;
}

/** Max compact rows clients should send in `AiLedgerContext.txns`. */
export const AI_CONTEXT_TXN_LIMIT = 400;

export type AiChartKind = 'category' | 'trend' | 'hours';

export interface AiChartPoint {
  label: string;
  /** Expense (or category / hour amount) in minor units of the space currency. */
  valueMinor: number;
  /** Income in minor units — only set for `trend` charts. */
  incomeMinor?: number;
}

export interface AiSuggestion {
  label: string;
  value: string;
  icon: string;
}

export type AiAction =
  | {
      type: 'create_category';
      name: string;
      categoryType: 'income' | 'expense';
    }
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
      suggestions: AiSuggestion[];
      note?: string;
    }
  | {
      type: 'ask_note';
      transactionId: string;
      suggestions: AiSuggestion[];
    }
  | {
      type: 'update_transaction';
      transactionId: string;
      note?: string;
      category?: string;
      amountMajor?: number;
      occurredAt?: string;
    }
  | {
      type: 'delete_transaction';
      transactionId: string;
    }
  | {
      type: 'hide_transaction';
      transactionId: string;
    }
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
  | {
      type: 'delete_goal';
      goalId: string;
    }
  | {
      type: 'create_recurring';
      name: string;
      amountMajor: number;
      kind: 'income' | 'expense';
      dayOfMonth: number;
      durationUnit?: 'forever' | 'months' | 'years';
      durationCount?: number | null;
    }
  | {
      type: 'update_recurring';
      recurringId: string;
      name?: string;
      amountMajor?: number;
      kind?: 'income' | 'expense';
      dayOfMonth?: number;
      active?: boolean;
      durationUnit?: 'forever' | 'months' | 'years';
      durationCount?: number | null;
    }
  | {
      type: 'delete_recurring';
      recurringId: string;
    }
  | {
      type: 'create_space';
      name: string;
      spaceType: 'personal' | 'household' | 'shared' | 'project' | 'family' | 'company';
      currency?: string;
    }
  | {
      type: 'switch_space';
      spaceId?: string;
      spaceName?: string;
    }
  | {
      type: 'invite_member';
      email: string;
      role: 'viewer' | 'contributor' | 'admin' | 'child';
    }
  | {
      type: 'report';
      title: string;
      body: string;
    }
  | {
      type: 'show_chart';
      chart: AiChartKind;
      title?: string;
      currency?: string;
      points: AiChartPoint[];
    };

export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  suggestions?: AiSuggestion[];
}
