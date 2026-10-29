import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  computePeriodTotals,
  currencyDecimalPlaces,
  filterByCategory,
  parseDisplayAmount,
  type CurrencyCode,
  type LedgerTransaction,
} from '@clear-money/domain';
import { ActivityTxnRow } from '../../src/components/ActivityTxnRow';
import { CategoryFilter } from '../../src/components/CategoryFilter';
import { ExportButton } from '../../src/components/ExportButton';
import { KeyboardAvoidingWrap } from '../../src/components/KeyboardAvoidingWrap';
import { SummaryCard } from '../../src/components/SummaryCard';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '../../src/components/MonthYearFilter';
import { SwipeableActivityRow } from '../../src/components/SwipeableActivityRow';
import { useToast } from '../../src/components/Toast';
import { t } from '../../src/lib/i18n';
import {
  archiveTxnId,
  loadArchivedTxnIds,
  restoreArchivedTxnId,
} from '../../src/lib/archived-txns';
import {
  categoryName,
  loadLedger,
  updateTransaction,
  visibleTransactionsForSpace,
  type MobileLedger,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { offlineQueue } from '../../src/offline/client';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, shadow, space } from '../../src/theme/tokens';

type TypeFilter = 'all' | 'expense' | 'income';

export default function ActivityScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [editing, setEditing] = useState<LedgerTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLocale((await loadSetupSession()).language);
    setArchivedIds(await loadArchivedTxnIds());
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
  const currency = activeSpace?.currency ?? 'USD';

  const monthRows = useMemo(() => {
    if (!ledger) return [];
    return visibleTransactionsForSpace(ledger, archivedIds).filter((txn) =>
      inMonthYear(txn.occurredAt, monthYear),
    );
  }, [ledger, archivedIds, monthYear]);

  const categoryOptions = useMemo(() => {
    if (!ledger) return [];
    const ids = new Set<string>();
    for (const txn of monthRows) {
      if (txn.categoryId) ids.add(txn.categoryId);
    }
    return [...ids]
      .map((id) => ({ id, name: categoryName(ledger, id, locale) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ledger, monthRows, locale]);

  const rows = useMemo(() => {
    let list = filterByCategory(monthRows, categoryId);
    if (typeFilter === 'expense') list = list.filter((t) => t.type === 'expense');
    if (typeFilter === 'income') list = list.filter((t) => t.type === 'income');
    return list;
  }, [monthRows, categoryId, typeFilter]);

  const totals = useMemo(() => computePeriodTotals(rows, currency), [rows, currency]);

  const fileSuffix = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}`;

  const handleArchive = async (id: string) => {
    setArchivedIds(await archiveTxnId(id));
    showToast({
      message: t(locale, 'app.entryArchived'),
      actionLabel: t(locale, 'app.undo'),
      onAction: () => {
        void restoreArchivedTxnId(id).then(setArchivedIds);
      },
    });
  };

  const openEdit = (txn: LedgerTransaction) => {
    const decimals = currencyDecimalPlaces(currency as CurrencyCode);
    setEditAmount(String(txn.amountMinor / 10 ** decimals));
    setEditNote(txn.description ?? '');
    setEditing(txn);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      const amountMinor = Math.abs(parseDisplayAmount(editAmount || '0', currency as CurrencyCode));
      if (amountMinor <= 0) throw new Error(t(locale, 'txn.enterAmount'));
      await updateTransaction(editing.spaceId, editing.id, {
        amountMinor,
        description: editNote.trim() || null,
      });
      setEditing(null);
      await refresh();
      showToast({ message: t(locale, 'app.saved') });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : t(locale, 'errors.generic') });
    } finally {
      setEditBusy(false);
    }
  };

  const typeChip = (value: TypeFilter, labelKey: string) => {
    const active = typeFilter === value;
    return (
      <Pressable
        key={value}
        onPress={() => setTypeFilter(value)}
        style={[
          styles.typeChip,
          {
            borderColor: active ? colors.brand : colors.border,
            backgroundColor: active ? colors.brandTint : colors.surface,
          },
        ]}
      >
        <Text style={{ color: active ? colors.brand : colors.inkSecondary, fontWeight: '700', fontSize: 12 }}>
          {t(locale, labelKey)}
        </Text>
      </Pressable>
    );
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
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => router.push('/archived-activity' as Href)}
                  style={[styles.archiveBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={{ color: colors.inkSecondary, fontWeight: '700', fontSize: 12 }}>
                    {t(locale, 'app.archived')}
                  </Text>
                </Pressable>
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
            </View>
            {ledger?.offline ? (
              <Text style={{ color: colors.warning, fontSize: 13 }}>{t(locale, 'home.offline')}</Text>
            ) : null}
            <View style={styles.typeRow}>
              {typeChip('all', 'app.filterAll')}
              {typeChip('expense', 'app.filterSpend')}
              {typeChip('income', 'app.filterReceive')}
            </View>
            <MonthYearFilter value={monthYear} onChange={setMonthYear} />
            <CategoryFilter
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
              locale={locale}
            />
            <View style={styles.totalsBlock}>
              <Text style={{ color: colors.inkMuted, fontSize: 12, fontWeight: '600' }}>
                {t(locale, 'app.filteredTotal')} ·{' '}
                {t(locale, 'app.filteredCount', { count: rows.length })}
              </Text>
              {typeFilter === 'income' ? (
                <SummaryCard
                  label={t(locale, 'app.income')}
                  amountMinor={totals.incomeMinor}
                  currency={currency}
                  locale={locale}
                  tone="income"
                />
              ) : typeFilter === 'expense' ? (
                <SummaryCard
                  label={t(locale, 'app.expense')}
                  amountMinor={totals.expenseMinor}
                  currency={currency}
                  locale={locale}
                  tone="expense"
                />
              ) : (
                <View style={styles.totalsGrid}>
                  <SummaryCard
                    label={t(locale, 'app.income')}
                    amountMinor={totals.incomeMinor}
                    currency={currency}
                    locale={locale}
                    tone="income"
                  />
                  <SummaryCard
                    label={t(locale, 'app.expense')}
                    amountMinor={totals.expenseMinor}
                    currency={currency}
                    locale={locale}
                    tone="expense"
                  />
                  <SummaryCard
                    label={t(locale, 'app.net')}
                    amountMinor={totals.netMinor}
                    currency={currency}
                    locale={locale}
                    tone={totals.netMinor >= 0 ? 'income' : 'expense'}
                  />
                </View>
              )}
            </View>
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
              onEdit={() => openEdit(item)}
              onArchive={() => void handleArchive(item.id)}
            >
              <ActivityTxnRow
                item={item}
                locale={locale}
                category={ledger ? categoryName(ledger, item.categoryId, locale) : ''}
                displayCurrency={currency}
              />
            </SwipeableActivityRow>
          </View>
        )}
      />

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingWrap style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditing(null)} />
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>{t(locale, 'app.editEntry')}</Text>
            <Text style={[styles.modalLabel, { color: colors.inkSecondary }]}>{t(locale, 'txn.amount')}</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.elevated }]}
            />
            <Text style={[styles.modalLabel, { color: colors.inkSecondary }]}>{t(locale, 'txn.note')}</Text>
            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.elevated }]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditing(null)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.inkSecondary, fontWeight: '600' }}>{t(locale, 'app.undo')}</Text>
              </Pressable>
              <Pressable
                disabled={editBusy}
                onPress={() => void saveEdit()}
                style={[styles.modalBtnPrimary, { backgroundColor: colors.brand, opacity: editBusy ? 0.6 : 1 }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'app.saveChanges')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingWrap>
      </Modal>
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
  headerActions: { gap: space[2], alignItems: 'flex-end' },
  archiveBtn: {
    minHeight: 36,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  hint: { marginTop: 4, fontSize: 13 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  totalsBlock: { gap: space[2] },
  totalsGrid: { gap: space[2] },
  typeChip: {
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
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
  modalRoot: { flex: 1, justifyContent: 'center', padding: space[5] },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: {
    borderRadius: radius.feature,
    borderWidth: 1,
    padding: space[5],
    gap: space[3],
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalLabel: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    fontSize: 16,
  },
  modalActions: { flexDirection: 'row', gap: space[2], marginTop: space[2] },
  modalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
