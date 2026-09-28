'use client';

import { Label } from '@/components/ui/label';

export type MonthYear = { year: number; month: number }; // month 0-11

export function currentMonthYear(): MonthYear {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function inMonthYear(iso: string, my: MonthYear): boolean {
  const d = new Date(iso);
  return d.getFullYear() === my.year && d.getMonth() === my.month;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function MonthYearFilter({
  value,
  onChange,
  label,
}: {
  value: MonthYear;
  onChange: (next: MonthYear) => void;
  label?: string;
}) {
  const years = Array.from({ length: 6 }, (_, i) => currentMonthYear().year - i);

  return (
    <div className="flex flex-wrap items-end gap-2">
      {label ? (
        <Label className="w-full text-xs text-ink-muted sm:w-auto sm:pb-2">{label}</Label>
      ) : null}
      <select
        className="h-10 rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 text-sm text-ink"
        aria-label="Month"
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
      >
        {MONTHS.map((name, idx) => (
          <option key={name} value={idx}>
            {name}
          </option>
        ))}
      </select>
      <select
        className="h-10 rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 text-sm text-ink"
        aria-label="Year"
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
