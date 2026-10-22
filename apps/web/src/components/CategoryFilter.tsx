'use client';

import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CategoryFilterOption = {
  id: string;
  name: string;
};

export function CategoryFilter({
  options,
  value,
  onChange,
  className,
}: {
  options: CategoryFilterOption[];
  value: string | 'all';
  onChange: (value: string | 'all') => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group" aria-label={t('reports.filterCategory')}>
      <button
        type="button"
        className={cn(
          'h-8 rounded-[var(--cm-radius-control)] border px-3 text-xs font-medium transition-colors',
          value === 'all'
            ? 'border-brand bg-brand-tint text-brand'
            : 'border-border bg-surface text-ink-secondary hover:border-brand/40',
        )}
        onClick={() => onChange('all')}
      >
        {t('reports.allCategories')}
      </button>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn(
            'h-8 max-w-[10rem] truncate rounded-[var(--cm-radius-control)] border px-3 text-xs font-medium transition-colors',
            value === opt.id
              ? 'border-brand bg-brand-tint text-brand'
              : 'border-border bg-surface text-ink-secondary hover:border-brand/40',
          )}
          onClick={() => onChange(opt.id)}
          title={opt.name}
        >
          {opt.name}
        </button>
      ))}
    </div>
  );
}
