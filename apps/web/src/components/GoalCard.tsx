'use client';

import {
  addMonthsToIsoDate,
  evaluateGoalPace,
  formatDate,
  formatMinorUnits,
  goalProgressRatio,
  goalRemaining,
  monthlyTargetMinor,
  type Goal,
  type GoalPaceStatus,
} from '@clear-money/domain';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n';

function paceIndicatorClass(pace: GoalPaceStatus): string {
  switch (pace) {
    case 'ahead':
    case 'on_track':
      return 'bg-income';
    case 'tight':
      return 'bg-warning';
    case 'behind':
    case 'lost':
      return 'bg-expense';
    case 'won':
      return 'bg-brand';
    default:
      return 'bg-brand';
  }
}

function paceBadgeClass(pace: GoalPaceStatus): string {
  switch (pace) {
    case 'ahead':
    case 'on_track':
      return 'bg-[color-mix(in_srgb,var(--cm-income)_15%,white)] text-income';
    case 'tight':
      return 'bg-[color-mix(in_srgb,var(--cm-warning)_15%,white)] text-warning';
    case 'behind':
    case 'lost':
      return 'bg-[color-mix(in_srgb,var(--cm-expense)_15%,white)] text-expense';
    case 'won':
      return 'bg-brand-tint text-brand';
    default:
      return 'bg-brand-tint text-brand';
  }
}

function resolveStartDate(goal: Goal): string {
  if (goal.startDate) return goal.startDate.slice(0, 10);
  const months = goal.durationMonths && goal.durationMonths >= 1 ? goal.durationMonths : 1;
  return addMonthsToIsoDate(goal.targetDate, -months);
}

export function GoalCard({ goal, locale = 'en' }: { goal: Goal; locale?: string }) {
  const { t } = useI18n();
  const ratio = goalProgressRatio(goal);
  const remaining = goalRemaining(goal);
  const asOf = new Date().toISOString().slice(0, 10);
  const paceEval = evaluateGoalPace(goal, asOf);
  const pace = paceEval.paceStatus;
  const monthly = monthlyTargetMinor(goal);
  const startDate = resolveStartDate(goal);
  const endDate = goal.targetDate.slice(0, 10);

  return (
    <article className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow transition-transform duration-[var(--cm-motion-medium)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{goal.name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize tracking-wide ${paceBadgeClass(pace)}`}
        >
          {t(`goals.pace.${pace}`)}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular text-ink">
        {formatMinorUnits(goal.savedMinor, goal.currency, locale)}
        <span className="text-base font-normal text-ink-muted">
          {' / '}
          {formatMinorUnits(goal.targetMinor, goal.currency, locale)}
        </span>
      </p>
      <Progress value={ratio * 100} className="mt-4" indicatorClassName={paceIndicatorClass(pace)} />
      <p className="mt-2 text-sm text-ink-secondary">
        {t('goals.remaining')}: {formatMinorUnits(remaining, goal.currency, locale)}
      </p>
      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{t('goals.monthlyTarget')}</dt>
          <dd className="tabular-nums font-medium text-ink">
            {formatMinorUnits(monthly, goal.currency, locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{t('goals.timeline')}</dt>
          <dd className="text-right text-ink-secondary">
            {formatDate(startDate, locale, Intl.DateTimeFormat().resolvedOptions().timeZone)} →{' '}
            {formatDate(endDate, locale, Intl.DateTimeFormat().resolvedOptions().timeZone)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{t('goals.expectedVsSaved')}</dt>
          <dd className="tabular-nums text-ink-secondary">
            {formatMinorUnits(paceEval.expectedMinor, goal.currency, locale)}
            {' / '}
            {formatMinorUnits(goal.savedMinor, goal.currency, locale)}
          </dd>
        </div>
        {goal.durationMonths ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">{t('goals.duration')}</dt>
            <dd className="text-ink-secondary">
              {t('goals.durationMonths', { count: goal.durationMonths })}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
