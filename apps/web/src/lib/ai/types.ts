export type AiChatRole = 'user' | 'assistant' | 'system';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiLedgerContext {
  currency: string;
  spaceName: string;
  spaceId: string;
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
    }
  | {
      type: 'report';
      title: string;
      body: string;
    };

export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  suggestions?: AiSuggestion[];
}
