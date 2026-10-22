import { formatMinorUnits, type HourBucket, type TrendPoint } from '@clear-money/domain';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { space } from '../theme/tokens';

const INCOME = '#1EC569';
const EXPENSE = '#D95D5D';
const HOUR = '#159A72';

export function TrendBars({
  points,
  currency,
  locale = 'en',
}: {
  points: TrendPoint[];
  currency: string;
  locale?: string;
}) {
  const colors = useThemeColors();
  if (!points.length) {
    return (
      <Text style={[styles.empty, { color: colors.inkMuted }]}>
        {t(locale, 'reports.insufficient')}
      </Text>
    );
  }
  const max = Math.max(
    ...points.flatMap((p) => [p.incomeMinor, p.expenseMinor]),
    1,
  );
  return (
    <View style={styles.trendWrap}>
      {points.slice(-8).map((p) => {
        const label =
          p.date.length >= 7
            ? p.date.slice(5, 7) + (p.date.length > 7 ? `/${p.date.slice(8, 10)}` : '')
            : p.date;
        return (
          <View key={p.date} style={styles.trendCol}>
            <View style={styles.barPair}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (p.incomeMinor / max) * 88),
                    backgroundColor: INCOME,
                  },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (p.expenseMinor / max) * 88),
                    backgroundColor: EXPENSE,
                  },
                ]}
              />
            </View>
            <Text style={[styles.tick, { color: colors.inkMuted }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
      <Text style={[styles.caption, { color: colors.inkMuted }]}>
        {t(locale, 'app.income')} {formatMinorUnits(points.reduce((s, p) => s + p.incomeMinor, 0), currency, locale)}
        {' · '}
        {t(locale, 'app.expense')}{' '}
        {formatMinorUnits(points.reduce((s, p) => s + p.expenseMinor, 0), currency, locale)}
      </Text>
    </View>
  );
}

export function HourBars({
  hours,
  currency,
  locale = 'en',
}: {
  hours: HourBucket[];
  currency: string;
  locale?: string;
}) {
  const colors = useThemeColors();
  const active = hours.filter((h) => h.amountMinor > 0);
  if (!active.length) {
    return (
      <Text style={[styles.empty, { color: colors.inkMuted }]}>
        {t(locale, 'reports.insufficient')}
      </Text>
    );
  }
  const max = Math.max(...hours.map((h) => h.amountMinor), 1);
  return (
    <View style={styles.hourWrap}>
      {hours.map((h) => (
        <View key={h.hour} style={styles.hourCol}>
          <View
            style={[
              styles.hourBar,
              {
                height: Math.max(h.amountMinor > 0 ? 4 : 0, (h.amountMinor / max) * 72),
                backgroundColor: HOUR,
                opacity: h.amountMinor > 0 ? 1 : 0.15,
              },
            ]}
          />
          {h.hour % 6 === 0 ? (
            <Text style={[styles.tick, { color: colors.inkMuted }]}>{h.hour}</Text>
          ) : (
            <View style={{ height: 14 }} />
          )}
        </View>
      ))}
      <Text style={[styles.caption, { color: colors.inkMuted }]}>
        {formatMinorUnits(
          hours.reduce((s, h) => s + h.amountMinor, 0),
          currency,
          locale,
        )}
      </Text>
    </View>
  );
}

export type LabeledBarPoint = { label: string; valueMinor: number; incomeMinor?: number };

/** Horizontal labeled bars (Penny category / trend charts). Trend rows add an income bar. */
export function LabeledBars({
  points,
  currency,
  locale = 'en',
}: {
  points: LabeledBarPoint[];
  currency: string;
  locale?: string;
}) {
  const colors = useThemeColors();
  if (!points.length) {
    return (
      <Text style={[styles.empty, { color: colors.inkMuted }]}>
        {t(locale, 'reports.insufficient')}
      </Text>
    );
  }
  const max = Math.max(...points.flatMap((p) => [p.valueMinor, p.incomeMinor ?? 0]), 1);
  const width = (minor: number) =>
    `${Math.max(minor > 0 ? 3 : 0, Math.round((minor / max) * 100))}%` as `${number}%`;
  return (
    <View style={styles.labeledWrap}>
      {points.map((p, i) => (
        <View key={`${p.label}-${i}`} style={styles.labeledRow}>
          <Text style={[styles.labeledLabel, { color: colors.inkSecondary }]} numberOfLines={1}>
            {p.label}
          </Text>
          <View style={styles.labeledBars}>
            {(p.incomeMinor ?? 0) > 0 ? (
              <View
                style={[styles.labeledBar, { width: width(p.incomeMinor ?? 0), backgroundColor: INCOME }]}
              />
            ) : null}
            <View style={[styles.labeledBar, { width: width(p.valueMinor), backgroundColor: EXPENSE }]} />
          </View>
          <Text style={[styles.labeledValue, { color: colors.inkSecondary }]} numberOfLines={1}>
            {formatMinorUnits(p.valueMinor, currency, locale)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  labeledWrap: { gap: 6 },
  labeledRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labeledLabel: { width: 64, fontSize: 11 },
  labeledBars: { flex: 1, gap: 2 },
  labeledBar: { height: 6, borderRadius: 3 },
  labeledValue: { width: 76, fontSize: 11, textAlign: 'right' },
  empty: { textAlign: 'center', paddingVertical: space[6], fontSize: 13 },
  trendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 120,
  },
  trendCol: { alignItems: 'center', width: 36, gap: 4 },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 92 },
  bar: { width: 10, borderRadius: 3 },
  tick: { fontSize: 9 },
  caption: { width: '100%', fontSize: 11, marginTop: space[2] },
  hourWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 96,
    gap: 1,
  },
  hourCol: { flex: 1, alignItems: 'center', gap: 2 },
  hourBar: { width: '100%', maxWidth: 10, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
