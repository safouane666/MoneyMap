'use client';

import { formatMinorUnits, type SafeToSpendResult } from '@clear-money/domain';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { SafeToSpendRing } from '@/components/SafeToSpendRing';
import { useI18n } from '@/lib/i18n';

export function SafeToSpendPanel({
  safe,
  incomeMinor,
  locale,
}: {
  safe: SafeToSpendResult;
  incomeMinor: number;
  locale: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (safe.status === 'insufficient') {
    return (
      <section className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow">
        <p className="text-sm font-medium text-ink">{t('goals.safeToSpendShort')}</p>
        <p className="mt-2 text-sm text-ink-secondary">{t('goals.insufficient')}</p>
      </section>
    );
  }

  const estimate = safe.estimateMinor ?? 0;
  const maxMinor = incomeMinor > 0 ? incomeMinor : Math.max(estimate, 1);

  return (
    <section className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
        <SafeToSpendRing
          estimateMinor={estimate}
          maxMinor={maxMinor}
          currency={safe.currency}
          locale={locale}
          subLabel={t('goals.safeToSpendShort')}
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t('goals.safeToSpendShort')}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">{t('goals.safeCaption')}</p>
        </div>
      </div>

      {safe.breakdown.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-sm font-medium text-brand hover:text-brand/90"
            aria-expanded={open}
          >
            <span>{open ? t('goals.hideDetails') : t('goals.detailsToggle')}</span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {open ? (
            <ul className="mt-2 space-y-1.5 text-sm text-ink-secondary">
              {safe.breakdown.map((row) => (
                <li key={row.label} className="flex justify-between gap-4">
                  <span>{row.label}</span>
                  <span className="tabular-nums text-ink">
                    {formatMinorUnits(row.amountMinor, safe.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
