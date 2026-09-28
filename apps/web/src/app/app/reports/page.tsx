'use client';

import { useMemo, useState } from 'react';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { PeriodSelector, type Period } from '@/components/PeriodSelector';
import { ExportDialog } from '@/components/ExportDialog';
import { SummaryCard } from '@/components/SummaryCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import {
  categoryBreakdown,
  getActiveSpace,
  getSpaceTotals,
  getSpaceTransactions,
} from '@/lib/demo-state';

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
  const [period, setPeriod] = useState<Period>('thisMonth');
  const space = getActiveSpace(state);

  const filtered = useMemo(
    () =>
      getSpaceTransactions(state).filter(
        (txn) => txn.type !== 'transfer' && inPeriod(txn.occurredAt, period),
      ),
    [state, period],
  );

  const scoped = useMemo(() => ({ ...state, transactions: filtered }), [filtered, state]);
  const totals = useMemo(() => getSpaceTotals(scoped, space.id), [scoped, space.id]);
  const breakdown = useMemo(() => categoryBreakdown(scoped, space.id), [scoped, space.id]);
  const count = filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-reveal">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.reports')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <ExportDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label={t('app.net')}
          amountMinor={totals.netMinor}
          currency={space.currency}
          locale={locale}
          tone="net"
          className="stagger-1"
        />
        <SummaryCard
          label={t('app.income')}
          amountMinor={totals.incomeMinor}
          currency={space.currency}
          locale={locale}
          tone="income"
          className="stagger-2"
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

      <Tabs defaultValue="categories" className="animate-reveal stagger-2">
        <TabsList>
          <TabsTrigger value="categories">{t('app.categories')}</TabsTrigger>
          <TabsTrigger value="time">{t('app.time')}</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow">
            <CategoryBreakdown items={breakdown} currency={space.currency} locale={locale} />
          </div>
        </TabsContent>
        <TabsContent value="time">
          <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 text-sm text-ink-secondary cm-shadow">
            {count < 5
              ? t('app.timeEmpty')
              : t('app.timeReady').replace('{count}', String(count)).replace('{space}', space.name)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
