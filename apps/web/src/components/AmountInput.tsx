'use client';

import { Delete, Equal } from 'lucide-react';
import { evaluateAmountExpression } from '@clear-money/domain';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  tone?: 'expense' | 'income';
  className?: string;
  showKeypad?: boolean;
}

type Key =
  | '1'
  | '2'
  | '3'
  | '+'
  | '4'
  | '5'
  | '6'
  | '−'
  | '7'
  | '8'
  | '9'
  | '×'
  | '.'
  | '0'
  | 'back'
  | '÷'
  | '=';

const KEYS: Key[] = [
  '1',
  '2',
  '3',
  '+',
  '4',
  '5',
  '6',
  '−',
  '7',
  '8',
  '9',
  '×',
  '.',
  '0',
  'back',
  '÷',
];

const OPS = new Set(['+', '−', '×', '÷']);

function lastNumberHasDot(expr: string): boolean {
  const m = expr.match(/[\d.]+$/);
  return Boolean(m?.[0]?.includes('.'));
}

function endsWithOperator(expr: string): boolean {
  return /[+\-−×÷*/x]$/i.test(expr.trim());
}

export function AmountInput({
  value,
  onChange,
  currency,
  tone = 'expense',
  className,
  showKeypad = true,
}: AmountInputProps) {
  const pressDigit = (digit: string) => {
    if (digit === '.') {
      if (!value || endsWithOperator(value)) {
        onChange(`${value}0.`);
        return;
      }
      if (lastNumberHasDot(value)) return;
      onChange(`${value}.`);
      return;
    }
    const m = value.match(/([\d.]*)$/);
    const currentNum = m?.[1] ?? '';
    if (currentNum.includes('.')) {
      const frac = currentNum.split('.')[1] ?? '';
      if (frac.length >= 3) return;
    } else if ((currentNum.replace(/^0+/, '') || '').length >= 9) {
      return;
    }
    if (value === '0') {
      onChange(digit);
      return;
    }
    onChange(`${value}${digit}`);
  };

  const pressOp = (op: string) => {
    if (!value) return;
    if (endsWithOperator(value)) {
      onChange(`${value.slice(0, -1)}${op}`);
      return;
    }
    onChange(`${value}${op}`);
  };

  const pressEquals = () => {
    if (!value || endsWithOperator(value)) return;
    try {
      onChange(evaluateAmountExpression(value));
    } catch {
      // keep expression; save will surface the error
    }
  };

  const press = (key: Key) => {
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '=') {
      pressEquals();
      return;
    }
    if (OPS.has(key)) {
      pressOp(key);
      return;
    }
    pressDigit(key);
  };

  const display = value || '0';
  const showCalcHint = /[+\-−×÷*/x]/i.test(value);

  return (
    <div className={cn('space-y-4', className)}>
      <button
        type="button"
        onClick={pressEquals}
        className="mx-auto block w-full text-center"
        title="Calculate"
        aria-label="Calculate amount"
      >
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{currency}</p>
        <p
          className={cn(
            'mt-2 break-all text-5xl font-semibold tabular-nums tracking-tight transition-colors duration-[var(--cm-motion-fast)]',
            tone === 'income' ? 'text-income' : 'text-expense',
          )}
          aria-live="polite"
        >
          {display}
        </p>
        {showCalcHint ? <p className="mt-1 text-xs text-ink-muted">Tap amount or = to calculate</p> : null}
      </button>

      {showKeypad ? (
        <div className="mx-auto grid max-w-sm grid-cols-4 gap-2">
          {KEYS.map((key) => {
            const isOp = OPS.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className={cn(
                  'flex h-14 items-center justify-center rounded-[var(--cm-radius-control)] text-xl font-medium transition-[background,transform] duration-[var(--cm-motion-fast)] active:scale-[0.97]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  isOp
                    ? 'bg-brand-tint font-semibold text-brand hover:bg-brand/20'
                    : 'bg-canvas text-ink hover:bg-brand-tint',
                )}
                aria-label={key === 'back' ? 'Delete' : key}
              >
                {key === 'back' ? <Delete className="h-5 w-5" /> : key}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => press('=')}
            className={cn(
              'col-span-4 flex h-12 items-center justify-center gap-2 rounded-[var(--cm-radius-control)] text-sm font-semibold text-brand',
              'bg-brand-tint hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.99]',
            )}
            aria-label="Equals"
          >
            <Equal className="h-4 w-4" />
            Calculate
          </button>
        </div>
      ) : (
        <input
          inputMode="decimal"
          aria-label="Amount"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.+\-×÷x*/]/gi, ''))}
          className="sr-only"
        />
      )}
    </div>
  );
}
