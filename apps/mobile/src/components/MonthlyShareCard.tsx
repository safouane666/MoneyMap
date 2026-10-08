import { formatMinorUnits, type Goal } from '@clear-money/domain';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, shadow, space } from '../theme/tokens';

export function MonthlyShareCard({
  spentMinor,
  safeToSpendMinor,
  currency,
  locale,
  goal,
  periodLabel,
}: {
  spentMinor: number;
  safeToSpendMinor: number | null;
  currency: string;
  locale: string;
  goal?: Goal | null;
  periodLabel: string;
}) {
  const colors = useThemeColors();
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const spent = formatMinorUnits(spentMinor, currency, locale);
    const safe =
      safeToSpendMinor === null
        ? '—'
        : formatMinorUnits(safeToSpendMinor, currency, locale);
    const goalLine = goal
      ? `Goal: ${goal.name} · ${formatMinorUnits(goal.savedMinor, goal.currency, locale)} / ${formatMinorUnits(goal.targetMinor, goal.currency, locale)}`
      : null;
    return ['Penny', periodLabel, `Spent: ${spent}`, `Safe to spend: ${safe}`, goalLine]
      .filter(Boolean)
      .join('\n');
  }, [currency, goal, locale, periodLabel, safeToSpendMinor, spentMinor]);

  return (
    <View
      style={[
        styles.card,
        shadow.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.top}>
        <View>
          <Text style={[styles.brand, { color: colors.brand }]}>Penny</Text>
          <Text style={[styles.period, { color: colors.inkMuted }]}>{periodLabel}</Text>
        </View>
        <Pressable
          onPress={() => {
            void Share.share({ message: text }).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          style={[styles.copyBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.copyLabel, { color: colors.ink }]}>
            {copied ? 'Summary copied' : 'Copy summary'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={[styles.dt, { color: colors.inkMuted }]}>Spent</Text>
          <Text style={[styles.dd, { color: colors.expense }]}>
            {formatMinorUnits(spentMinor, currency, locale)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.dt, { color: colors.inkMuted }]}>Safe to spend</Text>
          <Text style={[styles.dd, { color: colors.ink }]}>
            {safeToSpendMinor === null
              ? '—'
              : formatMinorUnits(safeToSpendMinor, currency, locale)}
          </Text>
        </View>
        {goal ? (
          <View style={styles.cell}>
            <Text style={[styles.dt, { color: colors.inkMuted }]}>Goal</Text>
            <Text style={[styles.dd, { color: colors.ink }]} numberOfLines={1}>
              {goal.name}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[3],
  },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  period: { marginTop: 4, fontSize: 13 },
  copyBtn: {
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  copyLabel: { fontSize: 12, fontWeight: '600' },
  grid: {
    marginTop: space[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  cell: { minWidth: '28%', flexGrow: 1 },
  dt: { fontSize: 12 },
  dd: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
