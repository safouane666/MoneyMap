'use client';

import { useEffect, useState } from 'react';
import { formatMinorUnits } from '@clear-money/domain';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  label: string;
  amountMinor: number;
  currency: string;
  locale?: string;
  tone?: 'default' | 'income' | 'expense' | 'net';
  animate?: boolean;
  className?: string;
  large?: boolean;
}

export function SummaryCard({
  label,
  amountMinor,
  currency,
  locale = 'en',
  tone = 'default',
  animate = true,
  className,
  large,
}: SummaryCardProps) {
  const [display, setDisplay] = useState(animate ? 0 : amountMinor);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced) {
      setDisplay(amountMinor);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = display;
    const duration = 420;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (amountMinor - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-animate when target changes
  }, [amountMinor, animate]);

  return (
    <div
      className={cn(
        'rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow transition-transform duration-[var(--cm-motion-medium)] hover:-translate-y-0.5',
        large && 'p-7',
        className,
      )}
    >
      <p className="text-sm text-ink-secondary">{label}</p>
      <p
        className={cn(
          'mt-2 font-semibold tabular-nums tracking-tight',
          large ? 'text-4xl md:text-5xl' : 'text-2xl',
          tone === 'income' && 'text-income',
          tone === 'expense' && 'text-expense',
          tone === 'net' && 'text-ink',
        )}
      >
        {formatMinorUnits(display, currency, locale)}
      </p>
    </div>
  );
}
