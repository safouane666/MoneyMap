import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { LedgerTransaction } from '@clear-money/domain';
import { ActivityTxnRow } from '../../src/components/ActivityTxnRow';
import { ExportButton } from '../../src/components/ExportButton';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '../../src/components/MonthYearFilter';
import { SwipeableActivityRow } from '../../src/components/SwipeableActivityRow';
import { useToast } from '../../src/components/Toast';
import { t } from '../../src/lib/i18n';
import { hideTxnId, loadHiddenTxnIds, unhideTxnId } from '../../src/lib/hidden-txns';
import {
  categoryName,
  deleteTransaction,
  loadLedger,
  restoreTransaction,
  visibleTransactionsForSpace,
  type MobileLedger,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { offlineQueue } from '../../src/offline/client';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, shadow, space } from '../../src/theme/tokens';

export default function ActivityScreen() {
  const colors = useThemeColors();
  const { showToast } = useToast();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);

  const refresh = useCallback(async () => {
    setLocale((await loadSetupSession()).language);
    setHiddenIds(await loadHiddenTxnIds());
    await offlineQueue.reconcile().catch(() => undefined);
    try {
      setLedger(await loadLedger());
    } catch {
      /* keep previous */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const activeSpace = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
  const rows = useMemo(() => {
    if (!ledger) return [];
    return visibleTransactionsForSpace(ledger, hiddenIds).filter((txn) =>
      inMonthYear(txn.occurredAt, monthYear),
    );
  }, [ledger, hiddenIds, monthYear]);

  const fileSuffix = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}`;

  const handleHide = async (id: string) => {
    setHiddenIds(await hideTxnId(id));
    showToast({
      message: t(locale, 'app.hidden'),
      actionLabel: t(locale, 'app.undo'),
      onAction: () => {
        void unhideTxnId(id).then(setHiddenIds);
      },
    });
  };

  const handleDelete = async (txn: LedgerTransaction) => {
    try {
      await deleteTransaction(txn.spaceId, txn.id);
      setLedger((prev) =>
        prev
          ? { ...prev, transactions: prev.transactions.filter((row) => row.id !== txn.id) }
          : prev,
      );
      showToast({
        message: t(locale, 'app.deleted'),
        actionLabel: t(locale, 'app.undo'),
        onAction: () => {
          void restoreTransaction(txn).then(() => void refresh());
        },
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : t(locale, 'errors.generic') });
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ gap: space[3], marginBottom: space[3] }}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'nav.activity')}</Text>
                <Text style={[styles.hint, { color: colors.inkSecondary }]}>
                  {t(locale, 'app.swipeHint')}
                </Text>
              </View>
              {activeSpace ? (
                <ExportButton
                  transactions={rows}
                  fileSuffix={fileSuffix}
                  spaceName={activeSpace.name}
                  role={activeSpace.role}
                  locale={locale}
                />
              ) : null}
            </View>
            {ledger?.offline ? (
              <Text style={{ color: colors.warning, fontSize: 13 }}>{t(locale, 'home.offline')}</Text>
            ) : null}
            <MonthYearFilter value={monthYear} onChange={setMonthYear} />
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={{ color: colors.inkSecondary, fontSize: 14, textAlign: 'center' }}>
              {t(locale, 'app.emptyHint')}
            </Text>
            <Text style={{ color: colors.inkMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              {t(locale, 'app.emptyCta')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              index === 0 && styles.listTop,
              index === rows.length - 1 && styles.listBottom,
              { borderColor: colors.border, backgroundColor: colors.surface },
              index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <SwipeableActivityRow
              locale={locale}
              onHide={() => void handleHide(item.id)}
              onDelete={() => void handleDelete(item)}
            >
              <ActivityTxnRow
                item={item}
                locale={locale}
                category={ledger ? categoryName(ledger, item.categoryId) : ''}
              />
            </SwipeableActivityRow>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[6],
    paddingBottom: 180,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  hint: { marginTop: 4, fontSize: 13 },
  empty: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
  listTop: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    ...shadow.card,
  },
  listBottom: {
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});
