'use client';

import { formatMinorUnits } from '@clear-money/domain';
import { useMemo } from 'react';

export type SafeToSpendRingProps = {
  estimateMinor: number;
  /** Soft ceiling — typically recorded income for the period. */
  maxMinor: number;
  currency: string;
  locale?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Shown inside the ring when set; otherwise the formatted estimate. */
  centerLabel?: string;
  subLabel?: string;
};

export function SafeToSpendRing({
  estimateMinor,
  maxMinor,
  currency,
  locale = 'en',
  size = 168,
  strokeWidth = 10,
  className = '',
  centerLabel,
  subLabel,
}: SafeToSpendRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ratio = useMemo(() => {
    if (maxMinor <= 0) return estimateMinor > 0 ? 1 : 0;
    return Math.min(1, Math.max(0, estimateMinor / maxMinor));
  }, [estimateMinor, maxMinor]);

  const dashOffset = circumference * (1 - ratio);
  const center =
    centerLabel ?? formatMinorUnits(Math.max(0, estimateMinor), currency, locale);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={center}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--cm-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--cm-brand)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <span className="text-lg font-semibold tabular-nums leading-tight text-ink sm:text-xl">
          {center}
        </span>
        {subLabel ? (
          <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            {subLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
