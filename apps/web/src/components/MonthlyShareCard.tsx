'use client';

import { useMemo, useState } from 'react';
import { formatMinorUnits, type Goal } from '@clear-money/domain';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function MonthlyShareCard({
  spentMinor,
  safeToSpendMinor,
  currency,
  locale,
  goal,
  periodLabel,
}: {
  spentMinor: number;
  safeToSpendMinor: number | null;
  currency: string;
  locale: string;
  goal?: Goal | null;
  periodLabel: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const spent = formatMinorUnits(spentMinor, currency, locale);
    const safe =
      safeToSpendMinor === null
        ? '—'
        : formatMinorUnits(safeToSpendMinor, currency, locale);
    const goalLine = goal
      ? `${t('app.shareCardGoal')}: ${goal.name} · ${formatMinorUnits(goal.savedMinor, goal.currency, locale)} / ${formatMinorUnits(goal.targetMinor, goal.currency, locale)}`
      : null;
    return [
      t('app.shareCardBrand'),
      periodLabel,
      `${t('app.shareCardSpent')}: ${spent}`,
      `${t('app.safeToSpend')}: ${safe}`,
      goalLine,
    ]
      .filter(Boolean)
      .join('\n');
  }, [currency, goal, locale, periodLabel, safeToSpendMinor, spentMinor, t]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <section
      className="animate-reveal stagger-4 overflow-hidden rounded-[var(--cm-radius-card)] border border-border bg-gradient-to-br from-surface via-surface to-canvas p-5 cm-shadow"
      aria-label={t('app.shareCard')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {t('app.shareCardBrand')}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{periodLabel}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? t('app.shareCardCopied') : t('app.shareCardCopy')}
        </Button>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-muted">{t('app.shareCardSpent')}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-expense">
            {formatMinorUnits(spentMinor, currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">{t('app.safeToSpend')}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {safeToSpendMinor === null
              ? '—'
              : formatMinorUnits(safeToSpendMinor, currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">{t('app.shareCardGoal')}</dt>
          <dd className="mt-1 truncate text-sm font-medium text-ink">
            {goal ? goal.name : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
