'use client';

import { formatMinorUnits, type HourBucket, type TrendPoint } from '@clear-money/domain';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@/lib/i18n';

function formatAxisDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  if (iso.length <= 10 && iso.endsWith('-01') && iso.length === 10) {
    return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function TrendChart({
  points,
  currency,
  locale = 'en',
}: {
  points: TrendPoint[];
  currency: string;
  locale?: string;
}) {
  const { t } = useI18n();
  if (!points.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{t('reports.insufficient')}</p>
    );
  }
  const data = points.map((p) => ({
    ...p,
    label: formatAxisDate(p.date, locale),
  }));
  return (
    <div className="h-56 w-full" role="img" aria-label={t('reports.trend')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cmIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1EC569" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#1EC569" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cmExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D95D5D" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#D95D5D" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--cm-ink-muted)' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--cm-ink-muted)' }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => formatMinorUnits(v, currency, locale)}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatMinorUnits(value, currency, locale),
              name === 'incomeMinor' ? t('app.income') : t('app.expense'),
            ]}
            contentStyle={{
              borderRadius: 12,
              borderColor: 'var(--cm-border)',
              background: 'var(--cm-surface)',
            }}
          />
          <Area
            type="monotone"
            dataKey="incomeMinor"
            stroke="#1EC569"
            fill="url(#cmIncome)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={600}
          />
          <Area
            type="monotone"
            dataKey="expenseMinor"
            stroke="#D95D5D"
            fill="url(#cmExpense)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourOfDayChart({
  hours,
  currency,
  locale = 'en',
}: {
  hours: HourBucket[];
  currency: string;
  locale?: string;
}) {
  const { t } = useI18n();
  const active = hours.filter((h) => h.amountMinor > 0);
  if (!active.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{t('reports.insufficient')}</p>
    );
  }
  const data = hours.map((h) => ({
    ...h,
    label: `${String(h.hour).padStart(2, '0')}`,
  }));
  return (
    <div className="h-48 w-full" role="img" aria-label={t('reports.timeOfDay')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--cm-ink-muted)' }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis hide />
          <Tooltip
            formatter={(value: number) => formatMinorUnits(value, currency, locale)}
            labelFormatter={(label) => `${label}:00`}
            contentStyle={{
              borderRadius: 12,
              borderColor: 'var(--cm-border)',
              background: 'var(--cm-surface)',
            }}
          />
          <Bar
            dataKey="amountMinor"
            fill="#159A72"
            radius={[4, 4, 0, 0]}
            isAnimationActive
            animationDuration={500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
