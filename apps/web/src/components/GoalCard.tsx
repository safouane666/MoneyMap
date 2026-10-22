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
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

function paceStroke(pace: GoalPaceStatus): string {
  switch (pace) {
    case 'ahead':
    case 'on_track':
      return 'var(--cm-income)';
    case 'tight':
      return 'var(--cm-warning)';
    case 'behind':
    case 'lost':
      return 'var(--cm-expense)';
    case 'won':
      return 'var(--cm-brand)';
    default:
      return 'var(--cm-brand)';
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

function GoalProgressRing({
  ratio,
  pace,
  savedLabel,
  targetLabel,
}: {
  ratio: number;
  pace: GoalPaceStatus;
  savedLabel: string;
  targetLabel: string;
}) {
  const size = 120;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, ratio));
  const dashOffset = circumference * (1 - clamped);
  const pct = Math.round(clamped * 100);

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--cm-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={paceStroke(pace)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-lg font-semibold tabular-nums text-ink">{pct}%</span>
        <span className="mt-0.5 max-w-full truncate text-[10px] tabular-nums text-ink-muted">
          {savedLabel}
        </span>
        <span className="max-w-full truncate text-[10px] tabular-nums text-ink-muted">
          / {targetLabel}
        </span>
      </div>
    </div>
  );
}

export function GoalCard({ goal, locale = 'en' }: { goal: Goal; locale?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ratio = goalProgressRatio(goal);
  const remaining = goalRemaining(goal);
  const asOf = new Date().toISOString().slice(0, 10);
  const paceEval = evaluateGoalPace(goal, asOf);
  const pace = paceEval.paceStatus;
  const monthly = monthlyTargetMinor(goal);
  const startDate = resolveStartDate(goal);
  const endDate = goal.targetDate.slice(0, 10);

  const savedLabel = useMemo(
    () => formatMinorUnits(goal.savedMinor, goal.currency, locale),
    [goal.currency, goal.savedMinor, locale],
  );
  const targetLabel = useMemo(
    () => formatMinorUnits(goal.targetMinor, goal.currency, locale),
    [goal.currency, goal.targetMinor, locale],
  );

  return (
    <article className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow transition-transform duration-[var(--cm-motion-medium)] hover:-translate-y-0.5">
      <div className="flex gap-4">
        <GoalProgressRing
          ratio={ratio}
          pace={pace}
          savedLabel={savedLabel}
          targetLabel={targetLabel}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug text-ink">{goal.name}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize tracking-wide ${paceBadgeClass(pace)}`}
            >
              {t(`goals.pace.${pace}`)}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-secondary">
            {t('goals.remaining')}{' '}
            <span className="font-medium tabular-nums text-ink">
              {formatMinorUnits(remaining, goal.currency, locale)}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-sm font-medium text-ink-muted hover:text-ink"
          aria-expanded={open}
        >
          <span>{open ? t('goals.hideDetails') : t('goals.detailsToggle')}</span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open ? (
          <dl className="mt-2 space-y-2 text-sm">
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
        ) : null}
      </div>
    </article>
  );
}
