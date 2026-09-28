'use client';

import { formatMinorUnits } from '@clear-money/domain';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useI18n } from '@/lib/i18n';

const COLORS = ['#5B5CE2', '#159A72', '#D95D5D', '#C78324', '#3B82F6', '#8B5CF6'];

interface CategoryBreakdownProps {
  items: Array<{ name: string; amountMinor: number }>;
  currency: string;
  locale?: string;
}

export function CategoryBreakdown({ items, currency, locale = 'en' }: CategoryBreakdownProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-ink-secondary">{t('app.emptyHint')}</p>
        <p className="mt-1 text-xs text-ink-muted">{t('app.emptyCta')}</p>
      </div>
    );
  }

  const data = items.map((i) => ({ name: i.name, value: i.amountMinor }));

  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
      <div className="mx-auto h-40 w-40" role="img" aria-label="Category breakdown chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} strokeWidth={0}>
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatMinorUnits(value, currency, locale)}
              contentStyle={{
                borderRadius: 12,
                borderColor: 'var(--cm-border)',
                background: 'var(--cm-surface)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[index % COLORS.length] }}
                aria-hidden
              />
              {item.name}
            </span>
            <span className="tabular text-ink-secondary">
              {formatMinorUnits(item.amountMinor, currency, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
