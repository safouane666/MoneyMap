'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  computeSafeToSpend,
  formatDate,
  formatMinorUnits,
  goalRemaining,
  monthlyTargetMinor,
} from '@clear-money/domain';
import { SummaryCard } from '@/components/SummaryCard';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { GoalCard } from '@/components/GoalCard';
import { MonthlyShareCard } from '@/components/MonthlyShareCard';
import { PeriodSelector, type Period } from '@/components/PeriodSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { useToast } from '@/components/Toast';
import { SwipeableActivityRow } from '@/components/SwipeableActivityRow';
import {
  categoryBreakdown,
  getActiveSpace,
  getSpaceTotals,
  getSpaceTransactions,
  getVisibleSpaceTransactions,
  sumActiveRecurringExpensesMinor,
} from '@/lib/demo-state';
import { RecurringHomeSection } from '@/components/RecurringHomeSection';
import type { LedgerTransaction } from '@clear-money/domain';

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

export default function HomePage() {
  const { t, locale } = useI18n();
  const { state, hideTransaction, unhideTransaction, undoTransaction, restoreTransaction } =
    useLedger();
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>('thisMonth');
  const space = getActiveSpace(state);

  const filtered = useMemo(
    () => getSpaceTransactions(state).filter((txn) => inPeriod(txn.occurredAt, period)),
    [state, period],
  );

  const totals = useMemo(() => {
    return getSpaceTotals({ ...state, transactions: filtered }, space.id);
  }, [filtered, space.id, state]);

  const goal = state.goals.find((g) => g.spaceId === space.id && g.status === 'active');

  const scheduledExpenseMinor = useMemo(
    () => sumActiveRecurringExpensesMinor(state, space.id),
    [state, space.id],
  );

  const safe = useMemo(() => {
    const planned = state.goals
      .filter((g) => g.spaceId === space.id && g.status === 'active')
      .reduce(
        (sum, g) =>
          sum + (g.plannedContributionMinor > 0 ? g.plannedContributionMinor : monthlyTargetMinor(g)),
        0,
      );
    return computeSafeToSpend({
      incomeMinor: totals.incomeMinor,
      expenseMinor: totals.expenseMinor,
      plannedContributionMinor: planned,
      scheduledExpenseMinor,
      bufferMinor: 0,
      currency: totals.currency,
      hasRequiredInputs: filtered.length > 0 || totals.incomeMinor > 0,
    });
  }, [
    filtered.length,
    space.id,
    scheduledExpenseMinor,
    state.goals,
    totals.currency,
    totals.expenseMinor,
    totals.incomeMinor,
  ]);

  const recent = getVisibleSpaceTransactions(state)
    .filter((txn) => txn.type !== 'transfer' && inPeriod(txn.occurredAt, period))
    .slice(0, 6);
  const breakdown = useMemo(
    () => categoryBreakdown({ ...state, transactions: filtered }, space.id).slice(0, 5),
    [filtered, space.id, state],
  );

  const periodLabel =
    period === 'thisWeek'
      ? t('app.thisWeek')
      : period === 'lastMonth'
        ? t('app.lastMonth')
        : t('app.thisMonth');

  const handleHide = (id: string) => {
    hideTransaction(id);
    showToast({
      message: t('app.hidden'),
      actionLabel: t('app.undo'),
      onAction: () => unhideTransaction(id),
    });
  };

  const handleDelete = (txn: LedgerTransaction) => {
    undoTransaction(txn.id);
    showToast({
      message: t('app.deleted'),
      actionLabel: t('app.undo'),
      onAction: () => restoreTransaction(txn),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-reveal">
        <div>
          <p className="text-sm text-ink-muted">{space.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('nav.home')}</h1>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <RecurringHomeSection spaceId={space.id} currency={space.currency} />

      <div className="space-y-4">
        <SummaryCard
          label={t('app.safeToSpend')}
          amountMinor={safe.estimateMinor ?? 0}
          currency={totals.currency}
          locale={locale}
          tone="net"
          large
          className="stagger-1"
        />
        <p className="-mt-2 text-xs text-ink-muted">{t('app.safeToSpendHint')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label={t('app.net')}
            amountMinor={totals.netMinor}
            currency={totals.currency}
            locale={locale}
            tone="net"
            className="stagger-2"
          />
          <SummaryCard
            label={t('app.income')}
            amountMinor={totals.incomeMinor}
            currency={totals.currency}
            locale={locale}
            tone="income"
            className="stagger-3"
          />
          <SummaryCard
            label={t('app.expense')}
            amountMinor={totals.expenseMinor}
            currency={totals.currency}
            locale={locale}
            tone="expense"
            className="stagger-3"
          />
        </div>
      </div>

      {period === 'thisMonth' ? (
        <MonthlyShareCard
          spentMinor={totals.expenseMinor}
          safeToSpendMinor={safe.estimateMinor}
          currency={totals.currency}
          locale={locale}
          goal={goal}
          periodLabel={periodLabel}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="animate-reveal stagger-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-secondary">{t('app.whereWent')}</h2>
            <Link href="/app/reports" className="inline-flex items-center gap-1 text-xs font-medium text-brand">
              {t('nav.reports')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow">
            <CategoryBreakdown items={breakdown} currency={space.currency} locale={locale} />
          </div>
        </section>

        <section className="animate-reveal stagger-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-secondary">{t('nav.goals')}</h2>
            <Link href="/app/goals" className="inline-flex items-center gap-1 text-xs font-medium text-brand">
              {t('app.viewAll')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {goal ? (
            <GoalCard goal={goal} locale={locale} />
          ) : (
            <div className="rounded-[var(--cm-radius-card)] border border-dashed border-border bg-surface p-6 text-sm text-ink-muted">
              {t('goals.empty')}
            </div>
          )}
        </section>
      </div>

      <section className="animate-reveal stagger-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink-secondary">{t('app.recent')}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/activity">{t('app.viewAll')}</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-[var(--cm-radius-card)] border border-dashed border-border bg-surface px-6 py-10 text-center">
            <p className="text-sm text-ink-secondary">{t('app.emptyHint')}</p>
            <p className="mt-1 text-xs text-ink-muted">{t('app.emptyCta')}</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-[var(--cm-radius-card)] border border-border bg-surface">
            {recent.map((txn, index) => {
              const cat = state.categories.find((c) => c.id === txn.categoryId);
              return (
                <li
                  key={txn.id}
                  className="border-b border-border last:border-b-0"
                  style={{ animationDelay: `${80 + index * 40}ms` }}
                >
                  <SwipeableActivityRow
                    onHide={() => handleHide(txn.id)}
                    onDelete={() => handleDelete(txn)}
                  >
                    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {txn.description || cat?.name || txn.type}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {formatDate(
                            txn.occurredAt,
                            locale,
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                          )}
                          {cat ? ` · ${cat.name}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p
                          className={`tabular-nums font-semibold ${
                            txn.type === 'income' ? 'text-income' : 'text-expense'
                          }`}
                        >
                          {txn.type === 'expense' ? '−' : '+'}
                          {formatMinorUnits(txn.amountMinor, txn.currency, locale)}
                        </p>
                        <Badge variant={txn.type === 'income' ? 'income' : 'expense'}>
                          {txn.type === 'income' ? t('txn.receive') : t('txn.spend')}
                        </Badge>
                      </div>
                    </div>
                  </SwipeableActivityRow>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {goal ? (
        <p className="sr-only">
          {goal.name} remaining {goalRemaining(goal)}
        </p>
      ) : null}
    </div>
  );
}
