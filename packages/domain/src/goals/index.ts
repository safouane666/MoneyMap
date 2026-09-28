export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface Goal {
  id: string;
  spaceId: string;
  name: string;
  targetMinor: number;
  savedMinor: number;
  currency: string;
  targetDate: string;
  plannedContributionMinor: number;
  notificationPolicy: 'off' | 'weekly' | 'on_progress';
  status: GoalStatus;
}

export interface SafeToSpendInput {
  incomeMinor: number;
  expenseMinor: number;
  plannedContributionMinor: number;
  scheduledExpenseMinor: number;
  bufferMinor: number;
  currency: string;
  hasRequiredInputs: boolean;
}

export interface SafeToSpendResult {
  status: 'ok' | 'insufficient';
  estimateMinor: number | null;
  currency: string;
  message: string;
  breakdown: Array<{ label: string; amountMinor: number }>;
}

export function goalRemaining(goal: Goal): number {
  return Math.max(0, goal.targetMinor - goal.savedMinor);
}

export function goalProgressRatio(goal: Goal): number {
  if (goal.targetMinor <= 0) return 0;
  return Math.min(1, goal.savedMinor / goal.targetMinor);
}

/**
 * available recorded income − confirmed expenses − planned goal contribution
 * − known scheduled expenses − explicit buffers.
 */
export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  if (!input.hasRequiredInputs) {
    return {
      status: 'insufficient',
      estimateMinor: null,
      currency: input.currency,
      message: 'Not enough data to estimate',
      breakdown: [],
    };
  }

  const estimate =
    input.incomeMinor -
    input.expenseMinor -
    input.plannedContributionMinor -
    input.scheduledExpenseMinor -
    input.bufferMinor;

  return {
    status: 'ok',
    estimateMinor: estimate,
    currency: input.currency,
    message: 'Estimate based on recorded income, expenses, planned contributions, and buffers.',
    breakdown: [
      { label: 'Income', amountMinor: input.incomeMinor },
      { label: 'Expenses', amountMinor: -input.expenseMinor },
      { label: 'Planned goal contribution', amountMinor: -input.plannedContributionMinor },
      { label: 'Scheduled expenses', amountMinor: -input.scheduledExpenseMinor },
      { label: 'Buffer', amountMinor: -input.bufferMinor },
    ],
  };
}
