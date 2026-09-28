'use client';

import { formatMinorUnits, goalProgressRatio, goalRemaining, type Goal } from '@clear-money/domain';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n';

export function GoalCard({ goal, locale = 'en' }: { goal: Goal; locale?: string }) {
  const { t } = useI18n();
  const ratio = goalProgressRatio(goal);
  const remaining = goalRemaining(goal);

  return (
    <article className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow transition-transform duration-[var(--cm-motion-medium)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{goal.name}</h3>
        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-brand">
          {goal.status}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular text-ink">
        {formatMinorUnits(goal.savedMinor, goal.currency, locale)}
        <span className="text-base font-normal text-ink-muted">
          {' / '}
          {formatMinorUnits(goal.targetMinor, goal.currency, locale)}
        </span>
      </p>
      <Progress value={ratio * 100} className="mt-4" />
      <p className="mt-2 text-sm text-ink-secondary">
        {t('goals.remaining')}: {formatMinorUnits(remaining, goal.currency, locale)}
      </p>
    </article>
  );
}
