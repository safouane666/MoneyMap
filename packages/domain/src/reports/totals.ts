export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'draft' | 'confirmed' | 'pending_sync';
export type TransactionSource = 'manual' | 'voice' | 'receipt' | 'import';

export interface LedgerTransaction {
  id: string;
  spaceId: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  /** Event time with original offset preserved in the ISO string. */
  occurredAt: string;
  createdAt: string;
  createdBy: string;
  source: TransactionSource;
  status: TransactionStatus;
}

export interface PeriodTotals {
  incomeMinor: number;
  expenseMinor: number;
  transferMinor: number;
  /** Income minus expenses. Transfers excluded. */
  netMinor: number;
  currency: string;
}

export function computePeriodTotals(
  transactions: LedgerTransaction[],
  currency: string,
): PeriodTotals {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let transferMinor = 0;

  for (const txn of transactions) {
    if (txn.status !== 'confirmed') continue;
    if (txn.currency !== currency) continue;
    if (txn.type === 'income') incomeMinor += txn.amountMinor;
    else if (txn.type === 'expense') expenseMinor += txn.amountMinor;
    else if (txn.type === 'transfer') transferMinor += txn.amountMinor;
  }

  return {
    incomeMinor,
    expenseMinor,
    transferMinor,
    netMinor: incomeMinor - expenseMinor,
    currency,
  };
}

export function requiresConfirmation(source: TransactionSource): boolean {
  return source === 'voice' || source === 'receipt';
}

export function isLateEntry(occurredAt: string, createdAt: string, hours = 48): boolean {
  const occurred = Date.parse(occurredAt);
  const created = Date.parse(createdAt);
  return created - occurred > hours * 60 * 60 * 1000;
}
