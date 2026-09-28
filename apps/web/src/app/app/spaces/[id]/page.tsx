'use client';

import { use } from 'react';
import Link from 'next/link';
import { formatMinorUnits } from '@clear-money/domain';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getSpaceTotals, getSpaceTransactions } from '@/lib/demo-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SpaceMembersPanel } from '@/components/SpaceMembersPanel';

export default function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const { state, setSpace } = useLedger();
  const space = state.spaces.find((s) => s.id === id);

  if (!space) {
    return (
      <Alert variant="warning">
        <AlertDescription>Space not found.</AlertDescription>
      </Alert>
    );
  }

  const totals = getSpaceTotals(state, space.id);
  const txns = getSpaceTransactions(state, space.id).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{space.name}</h1>
          <p className="text-sm text-ink-secondary">
            {space.currency} · {space.role}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/home" onClick={() => setSpace(space.id)}>
            {t('spaces.open')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-4">
          <p className="text-sm text-ink-secondary">{t('app.net')}</p>
          <p className="mt-1 text-xl font-semibold tabular">
            {formatMinorUnits(totals.netMinor, space.currency, locale)}
          </p>
        </div>
        <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-4">
          <p className="text-sm text-ink-secondary">{t('app.income')}</p>
          <p className="mt-1 text-xl font-semibold tabular text-income">
            {formatMinorUnits(totals.incomeMinor, space.currency, locale)}
          </p>
        </div>
        <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-4">
          <p className="text-sm text-ink-secondary">{t('app.expense')}</p>
          <p className="mt-1 text-xl font-semibold tabular text-expense">
            {formatMinorUnits(totals.expenseMinor, space.currency, locale)}
          </p>
        </div>
      </div>

      <SpaceMembersPanel spaceId={space.id} role={space.role} />

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">{t('app.recent')}</h2>
        <ul className="space-y-2">
          {txns.map((txn) => (
            <li
              key={txn.id}
              className="flex items-center justify-between rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 py-2"
            >
              <span>{txn.description || t(`txn.${txn.type}`)}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(`txn.${txn.type}`)}</Badge>
                <span className="tabular text-sm">
                  {formatMinorUnits(txn.amountMinor, txn.currency, locale)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
