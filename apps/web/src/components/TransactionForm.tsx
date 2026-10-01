'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { formatCategoryChip, parseAmountInput } from '@clear-money/domain';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getActiveSpace } from '@/lib/demo-state';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { usePennyNotify } from '@/lib/usePennyNotify';
import { cn } from '@/lib/utils';

type EntryType = 'income' | 'expense';

function toLocalInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TransactionForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useI18n();
  const { state, addTransaction, undoTransaction, addCategory } = useLedger();
  const { notifyEntry } = usePennyNotify();
  const space = getActiveSpace(state);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<EntryType>('expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue());
  const [note, setNote] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      state.categories.filter(
        (c) =>
          c.type === type &&
          (c.spaceId == null || c.spaceId === space.id),
      ),
    [state.categories, type, space.id],
  );

  useEffect(() => {
    if (!categoryId || !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? '');
    }
  }, [categories, categoryId, type]);

  const handleSave = () => {
    try {
      setError(null);
      const amountMinor = Math.abs(parseAmountInput(amount || '0', space.currency));
      if (amountMinor <= 0) {
        setError(t('txn.enterAmount'));
        return;
      }
      const created = addTransaction({
        spaceId: space.id,
        type,
        amountMinor,
        currency: space.currency,
        categoryId: categoryId || null,
        description: note.trim() || null,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      notifyEntry({
        type,
        amountMinor,
        currency: space.currency,
        spaceId: space.id,
        undoLabel: t('app.undo'),
        onUndo: () => undoTransaction(created.id),
        fallbackMessage: t('app.saved'),
      });
      setAmount('');
      setNote('');
      setMoreOpen(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('txn.enterAmount'));
    }
  };

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const created = addCategory({ name, type });
    setCategoryId(created.id);
    setNewCategoryName('');
    setAddingCategory(false);
  };

  return (
    <div className="flex max-h-[min(88dvh,720px)] flex-col gap-5 overflow-y-auto pb-2">
      <div
        className={cn(
          'rounded-[var(--cm-radius-feature)] p-4 transition-colors duration-[var(--cm-motion-medium)]',
          type === 'expense' ? 'bg-[color-mix(in_srgb,var(--cm-expense)_8%,var(--cm-canvas))]' : 'bg-[color-mix(in_srgb,var(--cm-income)_8%,var(--cm-canvas))]',
        )}
      >
        <AmountInput value={amount} onChange={setAmount} currency={space.currency} tone={type} />
      </div>

      <div
        role="tablist"
        aria-label={t('txn.type')}
        className="grid grid-cols-2 gap-1 rounded-[var(--cm-radius-control)] bg-canvas p-1"
      >
        {(['expense', 'income'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => {
              setType(value);
              setAddingCategory(false);
            }}
            className={cn(
              'h-11 rounded-[calc(var(--cm-radius-control)-2px)] text-sm font-semibold transition-all duration-[var(--cm-motion-fast)]',
              type === value
                ? value === 'expense'
                  ? 'bg-surface text-expense cm-shadow'
                  : 'bg-surface text-income cm-shadow'
                : 'text-ink-secondary hover:text-ink',
            )}
          >
            {value === 'expense' ? t('txn.spend') : t('txn.receive')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>{t('txn.category')}</Label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand"
            onClick={() => setAddingCategory((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('txn.addCategory')}
          </button>
        </div>

        {addingCategory ? (
          <div className="flex gap-2 animate-reveal">
            <Input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t('txn.categoryName')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
              }}
            />
            <Button type="button" onClick={handleCreateCategory}>
              {t('txn.create')}
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.length === 0 ? (
            <p className="col-span-full text-sm text-ink-muted">{t('txn.noCategories')}</p>
          ) : (
            categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'h-11 rounded-[var(--cm-radius-control)] border px-3 text-sm font-medium transition-all duration-[var(--cm-motion-fast)]',
                  categoryId === c.id
                    ? 'border-brand bg-brand-tint text-brand'
                    : 'border-border bg-surface text-ink hover:border-brand/40',
                )}
              >
                {formatCategoryChip(c.name, c.stableKey)}
              </button>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 py-3 text-sm font-medium text-ink-secondary"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
      >
        {t('txn.more')}
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-[var(--cm-motion-medium)]',
            moreOpen && 'rotate-180',
          )}
        />
      </button>

      {moreOpen ? (
        <div className="space-y-4 animate-reveal">
          <div className="space-y-2">
            <Label htmlFor="occurredAt">{t('txn.when')}</Label>
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">{t('txn.note')}</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('txn.notePlaceholder')}
            />
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-expense">{error}</p> : null}

      <Button
        className={cn(
          'h-12 w-full text-base text-white transition-transform duration-[var(--cm-motion-fast)] active:scale-[0.99]',
          type === 'income' ? 'bg-income hover:opacity-90' : 'bg-expense hover:opacity-90',
        )}
        onClick={handleSave}
      >
        {type === 'expense' ? t('txn.saveExpense') : t('txn.saveIncome')}
      </Button>
    </div>
  );
}
