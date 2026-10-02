export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type GoalPaceStatus = 'ahead' | 'on_track' | 'tight' | 'behind' | 'won' | 'lost';

export interface Goal {
  id: string;
  spaceId: string;
  name: string;
  targetMinor: number;
  savedMinor: number;
  currency: string;
  /** End date (ISO `YYYY-MM-DD`). */
  targetDate: string;
  /** Optional start date (ISO `YYYY-MM-DD`). */
  startDate?: string;
  /** Duration in months (>= 1). */
  durationMonths?: number;
  plannedContributionMinor: number;
  notificationPolicy: 'off' | 'weekly' | 'on_progress';
  status: GoalStatus;
  paceStatus?: GoalPaceStatus;
}

export interface GoalPaceEvaluation {
  paceStatus: GoalPaceStatus;
  expectedMinor: number;
  monthlyTargetMinor: number;
  monthsElapsed: number;
  monthsTotal: number;
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

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function parseIsoDateParts(iso: string): { y: number; m: number; d: number } {
  const date = isoDateOnly(iso);
  return {
    y: Number(date.slice(0, 4)),
    m: Number(date.slice(5, 7)),
    d: Number(date.slice(8, 10)),
  };
}

/** Add calendar months to an ISO date, clamping day to the target month length. */
export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const { y, m, d } = parseIsoDateParts(isoDate);
  const totalMonths = y * 12 + (m - 1) + months;
  const ny = Math.floor(totalMonths / 12);
  const nm = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Full calendar months elapsed from start to asOf (anniversary-based), floored at 0. */
export function monthsElapsedBetween(startDate: string, asOfDate: string): number {
  const start = isoDateOnly(startDate);
  const asOf = isoDateOnly(asOfDate);
  if (asOf < start) return 0;
  const s = parseIsoDateParts(start);
  const a = parseIsoDateParts(asOf);
  let months = (a.y - s.y) * 12 + (a.m - s.m);
  if (a.d < s.d) months -= 1;
  return Math.max(0, months);
}

function resolveDurationMonths(goal: Pick<Goal, 'durationMonths'>): number {
  const n = goal.durationMonths ?? 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function resolveStartDate(goal: Pick<Goal, 'startDate' | 'targetDate' | 'durationMonths'>): string {
  if (goal.startDate) return isoDateOnly(goal.startDate);
  const months = resolveDurationMonths(goal);
  return addMonthsToIsoDate(goal.targetDate, -months);
}

/**
 * Monthly save target: explicit planned contribution if set (> 0),
 * otherwise `ceil(targetMinor / durationMonths)`.
 */
export function monthlyTargetMinor(
  goal: Pick<Goal, 'targetMinor' | 'durationMonths' | 'plannedContributionMinor'>,
): number {
  if (goal.plannedContributionMinor > 0) return goal.plannedContributionMinor;
  const months = resolveDurationMonths(goal);
  return Math.ceil(goal.targetMinor / months);
}

/** Expected cumulative savings by `asOfDate` based on monthly target × months elapsed. */
export function expectedSavedByDate(goal: Goal, asOfDate: string): number {
  return evaluateGoalPace(goal, asOfDate).expectedMinor;
}

/**
 * Evaluate goal pacing vs expected cumulative savings.
 * - won if saved >= target
 * - lost if past/at end date and saved < target
 * - ahead if saved > expected * 1.05
 * - on_track if saved >= expected
 * - tight if saved >= expected * 0.85
 * - behind otherwise
 */
export function evaluateGoalPace(goal: Goal, asOfDate: string): GoalPaceEvaluation {
  const monthsTotal = resolveDurationMonths(goal);
  const startDate = resolveStartDate(goal);
  const endDate = isoDateOnly(goal.targetDate);
  const asOf = isoDateOnly(asOfDate);
  const monthly = monthlyTargetMinor({ ...goal, durationMonths: monthsTotal });

  let monthsElapsed = monthsElapsedBetween(startDate, asOf);
  monthsElapsed = Math.min(monthsElapsed, monthsTotal);

  const expectedMinor = Math.min(goal.targetMinor, monthly * monthsElapsed);
  const saved = goal.savedMinor;
  const pastEnd = asOf >= endDate;

  let paceStatus: GoalPaceStatus;
  if (saved >= goal.targetMinor) {
    paceStatus = 'won';
  } else if (pastEnd) {
    paceStatus = 'lost';
  } else if (saved > expectedMinor * 1.05) {
    paceStatus = 'ahead';
  } else if (saved >= expectedMinor) {
    paceStatus = 'on_track';
  } else if (saved >= expectedMinor * 0.85) {
    paceStatus = 'tight';
  } else {
    paceStatus = 'behind';
  }

  return {
    paceStatus,
    expectedMinor,
    monthlyTargetMinor: monthly,
    monthsElapsed,
    monthsTotal,
  };
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

  const raw =
    input.incomeMinor -
    input.expenseMinor -
    input.plannedContributionMinor -
    input.scheduledExpenseMinor -
    input.bufferMinor;
  // Never surface a negative "safe to spend" — floor at zero.
  const estimate = Math.max(0, raw);

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
