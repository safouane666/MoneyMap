import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { computePeriodTotals } from '@clear-money/domain';
import { CategoryBreakdown } from '../../src/components/CategoryBreakdown';
import { ExportButton } from '../../src/components/ExportButton';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '../../src/components/MonthYearFilter';
import { PeriodSelector, type Period } from '../../src/components/PeriodSelector';
import { SummaryCard } from '../../src/components/SummaryCard';
import { t } from '../../src/lib/i18n';
import {
  categoryName,
  loadLedger,
  transactionsForSpace,
  type MobileLedger,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, shadow, space } from '../../src/theme/tokens';

type ReportMode = Period | 'pickMonth';

function inPeriod(iso: string, period: Period): boolean {
  const d = new Date(iso);
  const now = new Date();
  if (period === 'thisWeek') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (period === 'thisMonth') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
}

export default function ReportsScreen() {
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [mode, setMode] = useState<ReportMode>('thisMonth');
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLocale((await loadSetupSession()).language);
        try {
          setLedger(await loadLedger());
        } catch {
          /* keep */
        }
      })();
    }, []),
  );

  const space = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
  const currency = space?.currency ?? 'USD';

  const filtered = useMemo(() => {
    const all = (ledger ? transactionsForSpace(ledger) : []).filter((txn) => txn.type !== 'transfer');
    if (mode === 'pickMonth') return all.filter((txn) => inMonthYear(txn.occurredAt, monthYear));
    return all.filter((txn) => inPeriod(txn.occurredAt, mode));
  }, [ledger, mode, monthYear]);

  const totals = computePeriodTotals(filtered, currency);
  const savesMinor = totals.netMinor;

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filtered) {
      if (row.type !== 'expense') continue;
      const name = ledger ? categoryName(ledger, row.categoryId) : 'Other';
      map.set(name, (map.get(name) ?? 0) + row.amountMinor);
    }
    return [...map.entries()]
      .map(([name, amountMinor]) => ({ name, amountMinor }))
      .sort((a, b) => b.amountMinor - a.amountMinor);
  }, [filtered, ledger]);

  const fileSuffix =
    mode === 'pickMonth'
      ? `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}`
      : mode;

  return (
    <View style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'nav.reports')}</Text>
        </View>
        <View style={styles.filters}>
          <PeriodSelector
            value={mode === 'pickMonth' ? 'thisMonth' : mode}
            onChange={(p) => setMode(p)}
            locale={locale}
          />
          <Pressable
            onPress={() => setMode('pickMonth')}
            style={[
              styles.pick,
              {
                borderColor: mode === 'pickMonth' ? colors.brand : colors.border,
                backgroundColor: mode === 'pickMonth' ? colors.brandTint : colors.surface,
              },
            ]}
          >
            <Text style={{ color: mode === 'pickMonth' ? colors.brand : colors.inkSecondary, fontWeight: '600' }}>
              {t(locale, 'app.pickMonth')}
            </Text>
          </Pressable>
          {space ? (
            <ExportButton
              transactions={filtered}
              fileSuffix={fileSuffix}
              spaceName={space.name}
              role={space.role}
              locale={locale}
            />
          ) : null}
        </View>
        {mode === 'pickMonth' ? (
          <MonthYearFilter value={monthYear} onChange={setMonthYear} />
        ) : null}

        {!ledger ? (
          <Text style={{ color: colors.inkSecondary }}>{t(locale, 'reports.empty')}</Text>
        ) : (
          <>
            <View style={styles.summary}>
              <SummaryCard
                label={t(locale, 'app.saves')}
                amountMinor={savesMinor}
                currency={currency}
                locale={locale}
                tone={savesMinor >= 0 ? 'income' : 'expense'}
              />
              <SummaryCard
                label={t(locale, 'home.net')}
                amountMinor={totals.netMinor}
                currency={currency}
                locale={locale}
                tone="net"
              />
              <SummaryCard
                label={t(locale, 'home.income')}
                amountMinor={totals.incomeMinor}
                currency={currency}
                locale={locale}
                tone="income"
              />
              <SummaryCard
                label={t(locale, 'home.expense')}
                amountMinor={totals.expenseMinor}
                currency={currency}
                locale={locale}
                tone="expense"
              />
            </View>
            <View
              style={[
                styles.panel,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.section, { color: colors.inkSecondary }]}>
                {t(locale, 'app.categories')}
              </Text>
              <CategoryBreakdown items={breakdown} currency={currency} locale={locale} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[6],
    paddingBottom: 180,
    gap: space[4],
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'flex-end' },
  pick: {
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  summary: { gap: space[4] },
  panel: { borderRadius: radius.card, borderWidth: 1, padding: space[5] },
  section: { fontSize: 14, fontWeight: '500', marginBottom: space[4] },
});
