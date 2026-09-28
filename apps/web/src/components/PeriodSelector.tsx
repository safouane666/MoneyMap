'use client';

import { useI18n } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type Period = 'thisWeek' | 'thisMonth' | 'lastMonth';

export function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-secondary">{t('app.period')}</span>
      <Select value={value} onValueChange={(v) => onChange(v as Period)}>
        <SelectTrigger className="w-[11rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="thisWeek">{t('app.thisWeek')}</SelectItem>
          <SelectItem value="thisMonth">{t('app.thisMonth')}</SelectItem>
          <SelectItem value="lastMonth">{t('app.lastMonth')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
