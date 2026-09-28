'use client';

import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  tone?: 'expense' | 'income';
  className?: string;
  showKeypad?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

export function AmountInput({
  value,
  onChange,
  currency,
  tone = 'expense',
  className,
  showKeypad = true,
}: AmountInputProps) {
  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value ? `${value}.` : '0.');
      return;
    }
    const digit = key;
    const [whole, frac = ''] = value.split('.');
    if (value.includes('.') && frac.length >= 3) return;
    if (!value.includes('.') && (whole?.replace(/^0+/, '') ?? '').length >= 9) return;
    if (value === '0') {
      onChange(digit);
      return;
    }
    onChange(`${value}${digit}`);
  };

  const display = value || '0';

  return (
    <div className={cn('space-y-5', className)}>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{currency}</p>
        <p
          className={cn(
            'mt-2 text-5xl font-semibold tabular-nums tracking-tight transition-colors duration-[var(--cm-motion-fast)]',
            tone === 'income' ? 'text-income' : 'text-expense',
          )}
          aria-live="polite"
        >
          {display}
        </p>
      </div>

      {showKeypad ? (
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className={cn(
                'flex h-14 items-center justify-center rounded-[var(--cm-radius-control)] text-xl font-medium text-ink transition-[background,transform] duration-[var(--cm-motion-fast)] active:scale-[0.97]',
                'bg-canvas hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
              aria-label={key === 'back' ? 'Delete' : key}
            >
              {key === 'back' ? <Delete className="h-5 w-5" /> : key}
            </button>
          ))}
        </div>
      ) : (
        <input
          inputMode="decimal"
          aria-label="Amount"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          className="sr-only"
        />
      )}
    </div>
  );
}
