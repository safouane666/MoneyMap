import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { t } from '@clear-money/i18n';
import { offlineQueue, offlineStore } from '../../src/offline/client';
import type { OfflineTransaction } from '../../src/offline/queue';
import { colors, radius, space } from '../../src/theme/tokens';

export default function ActivityScreen() {
  const [rows, setRows] = useState<OfflineTransaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await offlineQueue.reconcile().catch(() => undefined);
        setRows(await offlineStore.list());
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Text style={styles.title}>{t('en', 'nav.activity')}</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{t('en', 'txn.empty')}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.desc}>{item.description ?? item.type}</Text>
              <Text style={styles.meta}>
                {item.status === 'pending_sync'
                  ? t('en', 'txn.pendingSync')
                  : item.occurredAt.slice(0, 10)}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                { color: item.type === 'income' ? colors.income : colors.expense },
              ]}
            >
              {(item.amountMinor / 100).toFixed(2)} {item.currency}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space[6], paddingBottom: space[12], gap: space[3] },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: space[4] },
  empty: { color: colors.inkSecondary, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    gap: space[3],
  },
  desc: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.inkMuted, fontSize: 13, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
