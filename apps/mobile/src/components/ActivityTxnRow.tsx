import { StyleSheet, Text, View } from 'react-native';
import { formatDate, formatMinorUnits, type LedgerTransaction } from '@clear-money/domain';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

export function ActivityTxnRow({
  item,
  locale,
  category,
}: {
  item: LedgerTransaction;
  locale: string;
  category?: string;
}) {
  const colors = useThemeColors();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const income = item.type === 'income';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          {item.description || category || item.type}
        </Text>
        <Text style={[styles.meta, { color: colors.inkMuted }]}>
          {formatDate(item.occurredAt, locale, tz)}
          {category ? ` · ${category}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: income ? colors.income : colors.expense }]}>
          {item.type === 'expense' ? '−' : '+'}
          {formatMinorUnits(item.amountMinor, item.currency, locale)}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: income ? 'rgba(21,154,114,0.18)' : 'rgba(217,93,93,0.18)' },
          ]}
        >
          <Text style={[styles.badgeText, { color: income ? colors.income : colors.expense }]}>
            {income ? t(locale, 'txn.receive') : t(locale, 'txn.spend')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  title: { fontSize: 15, fontWeight: '500' },
  meta: { marginTop: 2, fontSize: 12 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
