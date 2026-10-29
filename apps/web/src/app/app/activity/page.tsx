'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  computePeriodTotals,
  currencyDecimalPlaces,
  filterByCategory,
  formatDate,
  formatMinorUnits,
  parseDisplayAmount,
  type CurrencyCode,
  type LedgerTransaction,
} from '@clear-money/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategoryFilter } from '@/components/CategoryFilter';
import { ExportDialog } from '@/components/ExportDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SummaryCard } from '@/components/SummaryCard';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '@/components/MonthYearFilter';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SwipeableActivityRow } from '@/components/SwipeableActivityRow';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace, getVisibleSpaceTransactions } from '@/lib/demo-state';
import { cn } from '@/lib/utils';

type TypeFilter = 'all' | 'expense' | 'income';

function ActivityItemContent({
  txn,
  categoryName,
  currency,
}: {
  txn: LedgerTransaction;
  categoryName?: string;
  currency: string;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{txn.description || categoryName || '—'}</p>
        <p className="text-xs text-ink-muted">
          {formatDate(txn.occurredAt, locale, Intl.DateTimeFormat().resolvedOptions().timeZone)}
          {categoryName ? ` · ${categoryName}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p
          className={`tabular-nums font-semibold ${
            txn.type === 'income' ? 'text-income' : 'text-expense'
          }`}
        >
          {txn.type === 'expense' ? '−' : '+'}
          {formatMinorUnits(txn.amountMinor, currency, locale)}
        </p>
        <Badge variant={txn.type === 'income' ? 'income' : 'expense'}>
          {txn.type === 'income' ? t('txn.receive') : t('txn.spend')}
        </Badge>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { t, locale } = useI18n();
  const { state, hideTransaction, unhideTransaction, updateTransaction } = useLedger();
  const { showToast } = useToast();
  const space = getActiveSpace(state);
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [editing, setEditing] = useState<LedgerTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const monthTxns = useMemo(
    () =>
      getVisibleSpaceTransactions(state).filter(
        (txn) => txn.type !== 'transfer' && inMonthYear(txn.occurredAt, monthYear),
      ),
    [state, monthYear],
  );

  const categoryOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const txn of monthTxns) {
      if (txn.categoryId) ids.add(txn.categoryId);
    }
    return [...ids]
      .map((id) => ({
        id,
        name: state.categories.find((c) => c.id === id)?.name ?? t('reports.other'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [monthTxns, state.categories, t]);

  const txns = useMemo(() => {
    let list = filterByCategory(monthTxns, categoryId);
    if (typeFilter === 'expense') list = list.filter((t) => t.type === 'expense');
    if (typeFilter === 'income') list = list.filter((t) => t.type === 'income');
    return list;
  }, [monthTxns, categoryId, typeFilter]);

  const totals = useMemo(
    () => computePeriodTotals(txns, space.currency),
    [txns, space.currency],
  );

  const fileSuffix = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}`;

  const handleArchive = (id: string) => {
    hideTransaction(id);
    showToast({
      message: t('app.entryArchived'),
      actionLabel: t('app.undo'),
      onAction: () => unhideTransaction(id),
    });
  };

  const openEdit = (txn: LedgerTransaction) => {
    const decimals = currencyDecimalPlaces(space.currency as CurrencyCode);
    setEditAmount(String(txn.amountMinor / 10 ** decimals));
    setEditNote(txn.description ?? '');
    setEditing(txn);
  };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    try {
      const amountMinor = Math.abs(
        parseDisplayAmount(editAmount || '0', space.currency as CurrencyCode),
      );
      if (amountMinor <= 0) throw new Error(t('txn.enterAmount'));
      updateTransaction(editing.id, {
        amountMinor,
        description: editNote.trim() || null,
      });
      setEditing(null);
      showToast({ message: t('app.saved') });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : t('errors.generic'),
      });
    } finally {
      setEditBusy(false);
    }
  };

  const typeChip = (value: TypeFilter, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setTypeFilter(value)}
      className={cn(
        'h-8 rounded-[var(--cm-radius-control)] border px-3 text-xs font-semibold',
        typeFilter === value
          ? 'border-brand bg-brand-tint text-brand'
          : 'border-border bg-surface text-ink-secondary',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-reveal">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('nav.activity')}</h1>
          <p className="mt-1 text-sm text-ink-secondary">{t('app.swipeHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/app/archived">{t('app.archived')}</Link>
          </Button>
          <MonthYearFilter value={monthYear} onChange={setMonthYear} />
          <ExportDialog
            transactions={txns}
            fileSuffix={fileSuffix}
            description={`CSV for ${fileSuffix} (${txns.length} rows).`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {typeChip('all', t('app.filterAll'))}
        {typeChip('expense', t('app.filterSpend'))}
        {typeChip('income', t('app.filterReceive'))}
      </div>

      <CategoryFilter options={categoryOptions} value={categoryId} onChange={setCategoryId} />

      <div className="animate-reveal space-y-2">
        <p className="text-xs font-medium text-ink-muted">
          {t('app.filteredTotal')} · {t('app.filteredCount', { count: txns.length })}
        </p>
        {typeFilter === 'income' ? (
          <SummaryCard
            label={t('app.income')}
            amountMinor={totals.incomeMinor}
            currency={space.currency}
            locale={locale}
            tone="income"
          />
        ) : typeFilter === 'expense' ? (
          <SummaryCard
            label={t('app.expense')}
            amountMinor={totals.expenseMinor}
            currency={space.currency}
            locale={locale}
            tone="expense"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label={t('app.income')}
              amountMinor={totals.incomeMinor}
              currency={space.currency}
              locale={locale}
              tone="income"
            />
            <SummaryCard
              label={t('app.expense')}
              amountMinor={totals.expenseMinor}
              currency={space.currency}
              locale={locale}
              tone="expense"
            />
            <SummaryCard
              label={t('app.net')}
              amountMinor={totals.netMinor}
              currency={space.currency}
              locale={locale}
              tone={totals.netMinor >= 0 ? 'income' : 'expense'}
            />
          </div>
        )}
      </div>

      {txns.length === 0 ? (
        <div className="animate-reveal stagger-1 rounded-[var(--cm-radius-card)] border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-secondary">{t('app.emptyHint')}</p>
          <p className="mt-1 text-xs text-ink-muted">{t('app.emptyCta')}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[var(--cm-radius-card)] border border-border bg-surface">
          {txns.map((txn, index) => {
            const cat = state.categories.find((c) => c.id === txn.categoryId);
            return (
              <li
                key={txn.id}
                className="border-b border-border last:border-b-0"
                style={{ animationDelay: `${60 + index * 35}ms` }}
              >
                <SwipeableActivityRow
                  onEdit={() => openEdit(txn)}
                  onArchive={() => handleArchive(txn.id)}
                >
                  <ActivityItemContent
                    txn={txn}
                    categoryName={cat?.name}
                    currency={space.currency}
                  />
                </SwipeableActivityRow>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('app.edit')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSaveEdit}>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">{t('txn.amount')}</Label>
              <Input
                id="edit-amount"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">{t('txn.note')}</Label>
              <Input
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editBusy || !editAmount.trim()}>
                {t('txn.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
