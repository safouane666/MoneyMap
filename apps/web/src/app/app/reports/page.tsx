'use client';

import { useMemo, useState } from 'react';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { PeriodSelector, type Period } from '@/components/PeriodSelector';
import { ExportDialog } from '@/components/ExportDialog';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '@/components/MonthYearFilter';
import { SummaryCard } from '@/components/SummaryCard';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import {
  categoryBreakdown,
  getActiveSpace,
  getSpaceTotals,
  getSpaceTransactions,
} from '@/lib/demo-state';

type ReportMode = Period | 'pickMonth';

function inPeriod(iso: string, period: Period): boolean {
  const d = new Date(iso);
  const now = new Date();
  if (period === 'thisWeek') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (period === 'thisMonth') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { state } = useLedger();
  const [mode, setMode] = useState<ReportMode>('thisMonth');
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);
  const space = getActiveSpace(state);

  const filtered = useMemo(() => {
    const all = getSpaceTransactions(state).filter((txn) => txn.type !== 'transfer');
    if (mode === 'pickMonth') return all.filter((txn) => inMonthYear(txn.occurredAt, monthYear));
    return all.filter((txn) => inPeriod(txn.occurredAt, mode));
  }, [state, mode, monthYear]);

  const scoped = useMemo(() => ({ ...state, transactions: filtered }), [filtered, state]);
  const totals = useMemo(() => getSpaceTotals(scoped, space.id), [scoped, space.id]);
  const breakdown = useMemo(() => categoryBreakdown(scoped, space.id), [scoped, space.id]);
  const savesMinor = totals.netMinor;

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
          label={t('app.net')}
          amountMinor={totals.netMinor}
          currency={space.currency}
          locale={locale}
          tone="net"
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

      <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow animate-reveal stagger-2">
        <h2 className="mb-4 text-sm font-medium text-ink-secondary">{t('app.categories')}</h2>
        <CategoryBreakdown items={breakdown} currency={space.currency} locale={locale} />
      </div>
    </div>
  );
}
