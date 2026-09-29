'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  currencyDecimalPlaces,
  formatDate,
  formatMinorUnits,
  parseDisplayAmount,
  type CurrencyCode,
} from '@clear-money/domain';
import type { SetupLanguage } from '@/lib/setup-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { useLedger, type RecurringItem } from '@/lib/ledger';
import { getSpaceRecurring } from '@/lib/demo-state';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';

function isDueWithinHours(nextDueAt: string | null, hours: number): boolean {
  if (!nextDueAt) return false;
  const due = new Date(nextDueAt).getTime();
  const now = Date.now();
  return due >= now && due <= now + hours * 3600 * 1000;
}

type RecurringFormProps = {
  kind: 'income' | 'expense';
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringItem | null;
  onSaved: () => void;
};

function RecurringFormDialog({
  kind,
  currency,
  open,
  onOpenChange,
  editing,
  onSaved,
}: RecurringFormProps) {
  const { t } = useI18n();
  const { createRecurring, updateRecurring } = useLedger();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      const decimals = currencyDecimalPlaces(currency as CurrencyCode);
      setAmount(String(editing.amountMinor / 10 ** decimals));
      setDay(String(editing.dayOfMonth));
    } else {
      setName('');
      setAmount('');
      setDay('1');
    }
    setError(null);
  }, [open, editing, currency]);

  const title =
    kind === 'income'
      ? editing
        ? t('recurring.editSalary')
        : t('recurring.addSalary')
      : editing
        ? t('recurring.editSubscription')
        : t('recurring.addSubscription');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const amountMinor = Math.abs(parseDisplayAmount(amount, currency as CurrencyCode));
      if (amountMinor <= 0) throw new ApiError(t('recurring.invalidAmount'), 400);
      const dayOfMonth = Math.trunc(Number(day));
      if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
        throw new ApiError(t('recurring.invalidDay'), 400);
      }
      const trimmed = name.trim();
      if (!trimmed) throw new ApiError(t('recurring.invalidName'), 400);
      if (editing) {
        await updateRecurring(editing.id, {
          name: trimmed,
          amountMinor,
          dayOfMonth,
          kind,
        });
      } else {
        await createRecurring({
          name: trimmed,
          amountMinor,
          kind,
          dayOfMonth,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('recurring.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rec-name">{t('recurring.name')}</Label>
            <Input
              id="rec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-amount">{t('recurring.amount')}</Label>
            <Input
              id="rec-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-day">{t('recurring.dayOfMonth')}</Label>
            <Input
              id="rec-day"
              type="number"
              min={1}
              max={28}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            <p className="text-xs text-ink-muted">{t('recurring.dayHint')}</p>
          </div>
          {error ? <p className="text-sm text-expense">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? t('recurring.saving') : t('recurring.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecurringListColumn({
  kind,
  items,
  currency,
  locale,
  signedIn,
  onAdd,
  onEdit,
  onDelete,
}: {
  kind: 'income' | 'expense';
  items: RecurringItem[];
  currency: string;
  locale: SetupLanguage;
  signedIn: boolean;
  onAdd: () => void;
  onEdit: (item: RecurringItem) => void;
  onDelete: (item: RecurringItem) => void;
}) {
  const { t } = useI18n();
  const title = kind === 'income' ? t('recurring.salaryTitle') : t('recurring.subscriptionsTitle');
  const empty =
    kind === 'income' ? t('recurring.salaryEmpty') : t('recurring.subscriptionsEmpty');

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-secondary">{title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={onAdd}
          disabled={!signedIn}
        >
          <Plus className="h-3.5 w-3.5" />
          {kind === 'income' ? t('recurring.addSalary') : t('recurring.addSubscription')}
        </Button>
      </div>
      {!signedIn ? (
        <p className="text-xs text-ink-muted">{t('recurring.needLogin')}</p>
      ) : null}
      <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">{empty}</p>
        ) : (
          <ul>
            {items.map((item, index) => {
              const dueSoon = isDueWithinHours(item.nextDueAt, 24);
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">
                      {t('recurring.dayLabel', { day: item.dayOfMonth })}
                      {item.nextDueAt
                        ? ` · ${t('recurring.nextDue')} ${formatDate(
                            item.nextDueAt,
                            locale,
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                          )}`
                        : null}
                    </p>
                    {dueSoon ? (
                      <Badge variant="expense" className="mt-1">
                        {t('recurring.dueSoon')}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p
                      className={`tabular-nums text-sm font-semibold ${
                        kind === 'income' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {kind === 'expense' ? '−' : '+'}
                      {formatMinorUnits(item.amountMinor, currency, locale)}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t('recurring.edit')}
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-expense"
                        aria-label={t('recurring.remove')}
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function RecurringHomeSection({ spaceId, currency }: { spaceId: string; currency: string }) {
  const { t, locale } = useI18n();
  const { state, signedIn, deleteRecurring } = useLedger();
  const { showToast } = useToast();
  const dueToastShown = useRef(false);

  const income = useMemo(
    () => getSpaceRecurring(state, spaceId, 'income'),
    [state, spaceId],
  );
  const expenses = useMemo(
    () => getSpaceRecurring(state, spaceId, 'expense'),
    [state, spaceId],
  );

  const [dialogKind, setDialogKind] = useState<'income' | 'expense'>('income');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringItem | null>(null);

  const openCreate = (kind: 'income' | 'expense') => {
    setEditing(null);
    setDialogKind(kind);
    setDialogOpen(true);
  };

  const openEdit = (item: RecurringItem) => {
    setEditing(item);
    setDialogKind(item.kind);
    setDialogOpen(true);
  };

  const handleDelete = async (item: RecurringItem) => {
    try {
      await deleteRecurring(item.id);
      showToast({ message: t('recurring.removed') });
    } catch (err) {
      showToast({
        message: err instanceof ApiError ? err.message : t('recurring.removeFailed'),
      });
    }
  };

  useEffect(() => {
    if (!signedIn || dueToastShown.current) return;
    const due = [...income, ...expenses].filter((r) => isDueWithinHours(r.nextDueAt, 24));
    if (due.length === 0) return;
    dueToastShown.current = true;
    const names = due.map((d) => d.name).join(', ');
    showToast({ message: t('recurring.dueSoonToast', { names }) });
  }, [signedIn, income, expenses, showToast, t]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 animate-reveal stagger-1">
        <RecurringListColumn
          kind="income"
          items={income}
          currency={currency}
          locale={locale}
          signedIn={signedIn}
          onAdd={() => openCreate('income')}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
        <RecurringListColumn
          kind="expense"
          items={expenses}
          currency={currency}
          locale={locale}
          signedIn={signedIn}
          onAdd={() => openCreate('expense')}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </div>
      <RecurringFormDialog
        kind={dialogKind}
        currency={currency}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => setEditing(null)}
      />
    </>
  );
}
