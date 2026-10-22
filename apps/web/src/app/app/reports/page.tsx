'use client';

import { useMemo, useState } from 'react';
import {
  categoryBreakdown,
  computePeriodTotals,
  filterByCategory,
  filterTransactionsByPeriod,
  formatMinorUnits,
  incomeExpenseTrend,
  spendingByHourOfDay,
  type ReportPeriod,
} from '@clear-money/domain';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PeriodSelector } from '@/components/PeriodSelector';
import { ExportDialog } from '@/components/ExportDialog';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '@/components/MonthYearFilter';
import { HourOfDayChart, TrendChart } from '@/components/ReportCharts';
import { SummaryCard } from '@/components/SummaryCard';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace, getSpaceTransactions } from '@/lib/demo-state';

type ReportMode = ReportPeriod | 'pickMonth';

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { state } = useLedger();
  const [mode, setMode] = useState<ReportMode>('thisMonth');
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const space = getActiveSpace(state);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const allTxns = useMemo(
    () => getSpaceTransactions(state).filter((txn) => txn.type !== 'transfer'),
    [state],
  );

  const nameFor = (id: string | null) => {
    if (!id) return t('reports.other');
    return state.categories.find((c) => c.id === id)?.name ?? t('reports.other');
  };

  const periodScoped = useMemo(() => {
    if (mode === 'pickMonth') {
      return allTxns.filter((txn) => inMonthYear(txn.occurredAt, monthYear));
    }
    return filterTransactionsByPeriod(allTxns, mode);
  }, [allTxns, mode, monthYear]);

  const categoryOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const txn of periodScoped) {
      if (txn.type === 'expense' && txn.categoryId) ids.add(txn.categoryId);
    }
    return [...ids]
      .map((id) => ({ id, name: nameFor(id) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [periodScoped, state.categories, locale, t]);

  const filtered = useMemo(
    () => filterByCategory(periodScoped, categoryId),
    [periodScoped, categoryId],
  );

  const totals = useMemo(
    () => computePeriodTotals(filtered, space.currency),
    [filtered, space.currency],
  );
  const categories = useMemo(
    () => categoryBreakdown(filtered, space.currency, nameFor, 'expense'),
    [filtered, space.currency, state.categories, t],
  );
  const hours = useMemo(
    () => spendingByHourOfDay(filtered, space.currency, tz),
    [filtered, space.currency, tz],
  );
  const trend = useMemo(() => {
    if (mode === 'pickMonth') {
      return incomeExpenseTrend(
        filterByCategory(allTxns, categoryId),
        space.currency,
        'thisMonth',
      ).filter((p) => {
        const d = new Date(p.date);
        return d.getMonth() === monthYear.month && d.getFullYear() === monthYear.year;
      });
    }
    return incomeExpenseTrend(
      filterByCategory(allTxns, categoryId),
      space.currency,
      mode,
    );
  }, [allTxns, mode, monthYear, categoryId, space.currency]);

  const daysInRange = Math.max(1, (() => {
    if (mode === 'pickMonth') {
      return new Date(monthYear.year, monthYear.month + 1, 0).getDate();
    }
    if (mode === 'allTime' && filtered.length) {
      const times = filtered.map((x) => Date.parse(x.occurredAt)).filter(Number.isFinite);
      if (times.length) {
        return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1);
      }
    }
    const map: Partial<Record<ReportPeriod, number>> = {
      thisWeek: 7,
      thisMonth: new Date().getDate(),
      lastMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate(),
      last3Months: 90,
      thisYear: Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000,
      ) + 1,
    };
    return map[mode as ReportPeriod] ?? 30;
  })());
  const avgDaily = Math.round(totals.expenseMinor / daysInRange);
  const savesMinor = totals.netMinor;
  const topCategory = categories[0] ?? null;

  const fileSuffix =
    mode === 'pickMonth'
      ? `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}`
      : mode;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-reveal">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.reports')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector
            extended
            value={mode === 'pickMonth' ? 'thisMonth' : mode}
            onChange={(p) => setMode(p)}
          />
          <button
            type="button"
            className={`h-10 rounded-[var(--cm-radius-control)] border px-3 text-sm ${
              mode === 'pickMonth'
                ? 'border-brand bg-brand-tint text-brand'
                : 'border-border bg-surface text-ink-secondary'
            }`}
            onClick={() => setMode('pickMonth')}
          >
            {t('app.pickMonth')}
          </button>
          {mode === 'pickMonth' ? (
            <MonthYearFilter value={monthYear} onChange={setMonthYear} />
          ) : null}
          <ExportDialog
            transactions={filtered}
            fileSuffix={fileSuffix}
            description={`CSV for filter “${fileSuffix}” (${filtered.length} rows).`}
          />
        </div>
      </div>

      <CategoryFilter options={categoryOptions} value={categoryId} onChange={setCategoryId} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={t('app.saves')}
          amountMinor={savesMinor}
          currency={space.currency}
          locale={locale}
          tone={savesMinor >= 0 ? 'income' : 'expense'}
          className="stagger-1"
        />
        <SummaryCard
          label={t('reports.avgDaily')}
          amountMinor={avgDaily}
          currency={space.currency}
          locale={locale}
          tone="expense"
          className="stagger-2"
        />
        <SummaryCard
          label={t('app.income')}
          amountMinor={totals.incomeMinor}
          currency={space.currency}
          locale={locale}
          tone="income"
          className="stagger-3"
        />
        <SummaryCard
          label={t('app.expense')}
          amountMinor={totals.expenseMinor}
          currency={space.currency}
          locale={locale}
          tone="expense"
          className="stagger-3"
        />
      </div>

      <section className="animate-reveal stagger-1">
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">{t('reports.trend')}</h2>
        <TrendChart points={trend} currency={space.currency} locale={locale} />
      </section>

      <section className="animate-reveal stagger-2">
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">{t('app.categories')}</h2>
        <CategoryBreakdown
          items={categories.map((c) => ({ name: c.name, amountMinor: c.amountMinor }))}
          currency={space.currency}
          locale={locale}
        />
      </section>

      <section className="animate-reveal stagger-3">
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">{t('reports.timeOfDay')}</h2>
        <HourOfDayChart hours={hours} currency={space.currency} locale={locale} />
        {topCategory ? (
          <p className="mt-2 text-xs text-ink-muted">
            {t('reports.topCategory')}: {topCategory.name} ·{' '}
            {formatMinorUnits(topCategory.amountMinor, space.currency, locale)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
