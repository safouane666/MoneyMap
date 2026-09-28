import { goalRemaining, type Goal } from '@clear-money/domain';
import type { PennyPose } from '@/components/penny/penny-states';
import { loadSetupSession } from '@/lib/setup-session';

export interface PennyReaction {
  message: string;
  pose: PennyPose;
}

type EntryType = 'income' | 'expense';

function activeGoals(goals: Goal[], spaceId: string) {
  return goals.filter((g) => g.spaceId === spaceId && g.status === 'active');
}

/** Rough bands in minor units (works for USD-like 2-decimal currencies). */
function band(amountMinor: number): 'small' | 'medium' | 'large' {
  if (amountMinor < 2_000) return 'small';
  if (amountMinor < 10_000) return 'medium';
  return 'large';
}

/**
 * Build a contextual Penny tip after a ledger entry.
 * Returns null when companion notifications are disabled in setup.
 */
export function buildPennyReaction(input: {
  type: EntryType;
  amountMinor: number;
  currency: string;
  spaceId: string;
  goals: Goal[];
  formatAmount: (minor: number, currency: string) => string;
  copy: {
    expenseSmall: string;
    expenseMedium: string;
    expenseLarge: string;
    expenseVsGoal: string;
    incomeSmall: string;
    incomeMedium: string;
    incomeLarge: string;
    incomeTowardGoal: string;
    goalAlmost: string;
    goalHit: string;
  };
}): PennyReaction | null {
  if (!loadSetupSession().notificationsEnabled) return null;

  const amount = input.formatAmount(input.amountMinor, input.currency);
  const goals = activeGoals(input.goals, input.spaceId);
  const primary = goals[0];
  const size = band(input.amountMinor);

  if (input.type === 'income') {
    if (primary) {
      const after = Math.min(primary.targetMinor, primary.savedMinor + input.amountMinor);
      const progress = Math.round((after / primary.targetMinor) * 100);
      if (after >= primary.targetMinor) {
        return {
          pose: 'goal',
          message: input.copy.goalHit
            .replace('{goal}', primary.name)
            .replace('{amount}', amount),
        };
      }
      if (progress >= 90) {
        return {
          pose: 'goal',
          message: input.copy.goalAlmost
            .replace('{goal}', primary.name)
            .replace('{pct}', String(progress))
            .replace('{amount}', amount),
        };
      }
      return {
        pose: size === 'large' ? 'goal' : 'saved',
        message: input.copy.incomeTowardGoal
          .replace('{amount}', amount)
          .replace('{goal}', primary.name)
          .replace('{pct}', String(progress)),
      };
    }

    if (size === 'large') {
      return { pose: 'goal', message: input.copy.incomeLarge.replace('{amount}', amount) };
    }
    if (size === 'medium') {
      return { pose: 'saved', message: input.copy.incomeMedium.replace('{amount}', amount) };
    }
    return { pose: 'thanks', message: input.copy.incomeSmall.replace('{amount}', amount) };
  }

  // expense
  if (primary) {
    const remaining = goalRemaining(primary);
    const planned = primary.plannedContributionMinor;
    if (planned > 0 && input.amountMinor >= planned) {
      return {
        pose: 'alert',
        message: input.copy.expenseVsGoal
          .replace('{amount}', amount)
          .replace('{goal}', primary.name)
          .replace('{planned}', input.formatAmount(planned, primary.currency)),
      };
    }
    if (remaining > 0 && input.amountMinor >= remaining * 0.25 && size !== 'small') {
      return {
        pose: 'think',
        message: input.copy.expenseVsGoal
          .replace('{amount}', amount)
          .replace('{goal}', primary.name)
          .replace('{planned}', input.formatAmount(planned || remaining, primary.currency)),
      };
    }
  }

  if (size === 'large') {
    return { pose: 'alert', message: input.copy.expenseLarge.replace('{amount}', amount) };
  }
  if (size === 'medium') {
    return { pose: 'think', message: input.copy.expenseMedium.replace('{amount}', amount) };
  }
  return { pose: 'idle', message: input.copy.expenseSmall.replace('{amount}', amount) };
}

export function pennyReactionCopy(t: (key: string) => string) {
  return {
    expenseSmall: t('penny.expenseSmall'),
    expenseMedium: t('penny.expenseMedium'),
    expenseLarge: t('penny.expenseLarge'),
    expenseVsGoal: t('penny.expenseVsGoal'),
    incomeSmall: t('penny.incomeSmall'),
    incomeMedium: t('penny.incomeMedium'),
    incomeLarge: t('penny.incomeLarge'),
    incomeTowardGoal: t('penny.incomeTowardGoal'),
    goalAlmost: t('penny.goalAlmost'),
    goalHit: t('penny.goalHit'),
  };
}
