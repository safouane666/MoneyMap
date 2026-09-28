'use client';

import { formatMinorUnits } from '@clear-money/domain';
import { useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { buildPennyReaction, pennyReactionCopy } from '@/lib/penny-reactions';

/** Fire a Penny tip after income/expense saves (respects setup notification toggle). */
export function usePennyNotify() {
  const { t, locale } = useI18n();
  const { showPennyTip, showToast } = useToast();
  const { state } = useLedger();

  const notifyEntry = useCallback(
    (input: {
      type: 'income' | 'expense';
      amountMinor: number;
      currency: string;
      spaceId: string;
      undoLabel?: string;
      onUndo?: () => void;
      fallbackMessage?: string;
    }) => {
      const reaction = buildPennyReaction({
        type: input.type,
        amountMinor: input.amountMinor,
        currency: input.currency,
        spaceId: input.spaceId,
        goals: state.goals,
        formatAmount: (minor, currency) => formatMinorUnits(minor, currency, locale),
        copy: pennyReactionCopy(t),
      });

      if (reaction) {
        showPennyTip({
          title: t('penny.title'),
          message: reaction.message,
          pose: reaction.pose,
          actionLabel: input.undoLabel,
          onAction: input.onUndo,
        });
        return;
      }

      if (input.fallbackMessage) {
        showToast({
          message: input.fallbackMessage,
          actionLabel: input.undoLabel,
          onAction: input.onUndo,
        });
      }
    },
    [locale, showPennyTip, showToast, state.goals, t],
  );

  return { notifyEntry };
}
