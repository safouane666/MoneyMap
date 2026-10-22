'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatDate, formatMinorUnits, type LedgerTransaction } from '@clear-money/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace, getSpaceTransactions } from '@/lib/demo-state';

export default function ArchivedActivityPage() {
  const { t, locale } = useI18n();
  const { state, unhideTransaction } = useLedger();
  const { showToast } = useToast();
  const space = getActiveSpace(state);

  const rows = useMemo(() => {
    const hidden = new Set(state.hiddenIds);
    return getSpaceTransactions(state)
      .filter((txn) => txn.type !== 'transfer' && hidden.has(txn.id))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }, [state]);

  const restore = (txn: LedgerTransaction) => {
    unhideTransaction(txn.id);
    showToast({ message: t('app.restored') });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-reveal">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.archivedTitle')}</h1>
          <p className="mt-1 text-sm text-ink-secondary">{t('app.archivedHint')}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/activity">{t('nav.activity')}</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--cm-radius-card)] border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-secondary">{t('app.archivedEmpty')}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[var(--cm-radius-card)] border border-border bg-surface">
          {rows.map((txn) => {
            const cat = state.categories.find((c) => c.id === txn.categoryId);
            return (
              <li
                key={txn.id}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {txn.description || cat?.name || '—'}
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
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-end">
                    <p
                      className={`tabular-nums font-semibold ${
                        txn.type === 'income' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {txn.type === 'expense' ? '−' : '+'}
                      {formatMinorUnits(txn.amountMinor, space.currency, locale)}
                    </p>
                    <Badge variant={txn.type === 'income' ? 'income' : 'expense'}>
                      {txn.type === 'income' ? t('txn.receive') : t('txn.spend')}
                    </Badge>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => restore(txn)}>
                    {t('app.restore')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
