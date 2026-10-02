import type { Goal } from '@clear-money/domain';
import type { ToastPayload } from '../components/Toast';
import type { PennyPose } from '../components/penny/penny-states';
import { t } from './i18n';
import { buildPennyReaction } from './penny-reactions';
import { loadSetupSession } from './setup-session';

/** Fire a Penny tip after income/expense saves (respects setup notification toggle). */
export async function notifyPennyEntry(input: {
  type: 'income' | 'expense';
  amountMinor: number;
  currency: string;
  spaceId: string;
  goals: Goal[];
  locale: string;
  formatAmount: (minor: number, currency: string) => string;
  showPennyTip: (payload: Omit<ToastPayload, 'fromPenny'> & { message: string }) => void;
  showToast: (payload: ToastPayload) => void;
  fallbackMessage?: string;
  undoLabel?: string;
  onUndo?: () => void;
}): Promise<void> {
  const setup = await loadSetupSession();
  if (!setup.notificationsEnabled) {
    if (input.fallbackMessage) {
      input.showToast({
        message: input.fallbackMessage,
        actionLabel: input.undoLabel,
        onAction: input.onUndo,
      });
    }
    return;
  }

  const reaction = buildPennyReaction({
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    spaceId: input.spaceId,
    goals: input.goals,
    formatAmount: input.formatAmount,
    copy: {
      expenseSmall: t(input.locale, 'penny.expenseSmall'),
      expenseMedium: t(input.locale, 'penny.expenseMedium'),
      expenseLarge: t(input.locale, 'penny.expenseLarge'),
      expenseVsGoal: t(input.locale, 'penny.expenseVsGoal'),
      incomeSmall: t(input.locale, 'penny.incomeSmall'),
      incomeMedium: t(input.locale, 'penny.incomeMedium'),
      incomeLarge: t(input.locale, 'penny.incomeLarge'),
      incomeTowardGoal: t(input.locale, 'penny.incomeTowardGoal'),
      goalAlmost: t(input.locale, 'penny.goalAlmost'),
      goalHit: t(input.locale, 'penny.goalHit'),
    },
  });

  input.showPennyTip({
    title: t(input.locale, 'penny.title'),
    message: reaction.message,
    pose: reaction.pose as PennyPose,
    actionLabel: input.undoLabel,
    onAction: input.onUndo,
  });
}
