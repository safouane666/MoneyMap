'use client';

import { formatDate, formatMinorUnits, type LedgerTransaction } from '@clear-money/domain';
import { Badge } from '@/components/ui/badge';
import { SwipeableActivityRow } from '@/components/SwipeableActivityRow';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getVisibleSpaceTransactions } from '@/lib/demo-state';

function ActivityItemContent({
  txn,
  categoryName,
}: {
  txn: LedgerTransaction;
  categoryName?: string;
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
          {formatMinorUnits(txn.amountMinor, txn.currency, locale)}
        </p>
        <Badge variant={txn.type === 'income' ? 'income' : 'expense'}>
          {txn.type === 'income' ? t('txn.receive') : t('txn.spend')}
        </Badge>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { t } = useI18n();
  const { state, hideTransaction, unhideTransaction, undoTransaction, restoreTransaction } =
    useLedger();
  const { showToast } = useToast();
  const txns = getVisibleSpaceTransactions(state).filter((txn) => txn.type !== 'transfer');

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
    <div className="space-y-6">
      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.activity')}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{t('app.swipeHint')}</p>
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
                  onHide={() => handleHide(txn.id)}
                  onDelete={() => handleDelete(txn)}
                >
                  <ActivityItemContent txn={txn} categoryName={cat?.name} />
                </SwipeableActivityRow>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
