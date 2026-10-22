'use client';

import type { ReportPeriod } from '@clear-money/domain';
import { useI18n } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** @deprecated Prefer ReportPeriod from domain; kept for home compatibility. */
export type Period = 'thisWeek' | 'thisMonth' | 'lastMonth';

export type ExtendedPeriod = ReportPeriod;

const PERIOD_KEYS: Record<ReportPeriod, string> = {
  thisWeek: 'app.thisWeek',
  thisMonth: 'app.thisMonth',
  lastMonth: 'app.lastMonth',
  last3Months: 'app.last3Months',
  thisYear: 'app.thisYear',
  allTime: 'app.allTime',
};

export function PeriodSelector({
  value,
  onChange,
  extended = false,
}: {
  value: ReportPeriod | Period;
  onChange: (value: ReportPeriod) => void;
  /** When true, include 3mo / year / all-time. */
  extended?: boolean;
}) {
  const { t } = useI18n();
  const options: ReportPeriod[] = extended
    ? ['thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'allTime']
    : ['thisWeek', 'thisMonth', 'lastMonth'];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-secondary">{t('app.period')}</span>
      <Select value={value} onValueChange={(v) => onChange(v as ReportPeriod)}>
        <SelectTrigger className="w-[12rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((p) => (
            <SelectItem key={p} value={p}>
              {t(PERIOD_KEYS[p])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
