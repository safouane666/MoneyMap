import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityTxnRow } from '../src/components/ActivityTxnRow';
import { t } from '../src/lib/i18n';
import {
  loadArchivedTxnIds,
  restoreArchivedTxnId,
} from '../src/lib/archived-txns';
import {
  categoryName,
  loadLedger,
  type MobileLedger,
} from '../src/lib/ledger';
import { loadSetupSession } from '../src/lib/setup-session';
import { useThemeColors } from '../src/theme/ThemeContext';
import { radius, space } from '../src/theme/tokens';

export default function ArchivedActivityScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLocale((await loadSetupSession()).language);
    setArchivedIds(await loadArchivedTxnIds());
    setLedger(await loadLedger().catch(() => null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const space = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
  const currency = space?.currency;

  const rows = useMemo(() => {
    if (!ledger) return [];
    const set = new Set(archivedIds);
    return ledger.transactions
      .filter((txn) => txn.spaceId === ledger.activeSpaceId && set.has(txn.id))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }, [ledger, archivedIds]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={[styles.back, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'app.archivedTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.inkSecondary, textAlign: 'center' }}>
              {t(locale, 'app.archivedEmpty')}
            </Text>
            <Text style={{ color: colors.inkMuted, textAlign: 'center', marginTop: 6, fontSize: 12 }}>
              {t(locale, 'app.archivedHint')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <ActivityTxnRow
              item={item}
              locale={locale}
              category={ledger ? categoryName(ledger, item.categoryId, locale) : ''}
              displayCurrency={currency}
            />
            <Pressable
              onPress={() => {
                void restoreArchivedTxnId(item.id).then(setArchivedIds);
              }}
              style={[styles.restore, { borderColor: colors.brand, backgroundColor: colors.brandTint }]}
            >
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>
                {t(locale, 'app.restore')}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { padding: space[4], paddingBottom: 120, gap: space[3] },
  empty: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: space[6],
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  restore: {
    marginHorizontal: space[4],
    marginBottom: space[3],
    minHeight: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
