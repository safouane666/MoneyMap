import { formatMinorUnits } from '@clear-money/domain';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { space } from '../theme/tokens';

const CHART_COLORS = ['#1EC569', '#159A72', '#D95D5D', '#C78324', '#3B82F6', '#8B5CF6'];

/**
 * Bar + legend breakdown. Avoids react-native-svg so Expo Go (New Arch) does not
 * crash on missing RNSVG Fabric codegen. APK can later add a pie via a gated import.
 */
export function CategoryBreakdown({
  items,
  currency,
  locale = 'en',
}: {
  items: Array<{ name: string; amountMinor: number }>;
  currency: string;
  locale?: string;
}) {
  const colors = useThemeColors();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.inkSecondary }]}>
          {t(locale, 'app.emptyHint')}
        </Text>
        <Text style={[styles.emptySub, { color: colors.inkMuted }]}>{t(locale, 'app.emptyCta')}</Text>
      </View>
    );
  }

  const max = Math.max(...items.map((i) => i.amountMinor), 1);

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={item.name} style={styles.row}>
          <View style={styles.head}>
            <View style={styles.nameRow}>
              <View
                style={[styles.dot, { backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }]}
              />
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Text style={[styles.amount, { color: colors.inkSecondary }]}>
              {formatMinorUnits(item.amountMinor, currency, locale)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.round((item.amountMinor / max) * 100)}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: space[6], alignItems: 'center' },
  emptyTitle: { fontSize: 14 },
  emptySub: { marginTop: 4, fontSize: 12 },
  list: { gap: space[3] },
  row: { gap: space[2] },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 14 },
  amount: { fontSize: 14, fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 999 },
});
