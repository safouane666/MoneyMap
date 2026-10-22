import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  busiestSpendingHour,
  categoryBreakdown,
  computePeriodTotals,
  filterByCategory,
  filterTransactionsByPeriod,
  formatMinorUnits,
  highestSpendingWeekday,
  incomeExpenseTrend,
  spendingByHourOfDay,
  zoomPeriod,
  type ReportPeriod,
} from '@clear-money/domain';
import { CategoryBreakdown } from '../../src/components/CategoryBreakdown';
import { CategoryFilter } from '../../src/components/CategoryFilter';
import { ExportButton } from '../../src/components/ExportButton';
import {
  MonthYearFilter,
  currentMonthYear,
  inMonthYear,
  type MonthYear,
} from '../../src/components/MonthYearFilter';
import { HourBars, TrendBars } from '../../src/components/ReportMiniCharts';
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

type ReportMode = ReportPeriod | 'pickMonth';

const PERIOD_CHIPS: Array<{ value: ReportPeriod; labelKey: string }> = [
  { value: 'thisWeek', labelKey: 'home.thisWeek' },
  { value: 'thisMonth', labelKey: 'home.thisMonth' },
  { value: 'lastMonth', labelKey: 'home.lastMonth' },
  { value: 'last3Months', labelKey: 'home.last3Months' },
  { value: 'thisYear', labelKey: 'home.thisYear' },
  { value: 'allTime', labelKey: 'home.allTime' },
];

function pinchDistance(touches: NativeTouchEvent[]): number | null {
  if (touches.length < 2) return null;
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function daysInRange(mode: ReportMode, monthYear: MonthYear, filteredLen: number, filtered: { occurredAt: string }[]): number {
  if (mode === 'pickMonth') {
    return new Date(monthYear.year, monthYear.month + 1, 0).getDate();
  }
  if (mode === 'allTime' && filteredLen) {
    const times = filtered.map((x) => Date.parse(x.occurredAt)).filter(Number.isFinite);
    if (times.length) {
      return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1);
    }
  }
  const map: Partial<Record<ReportPeriod, number>> = {
    thisWeek: 7,
    thisMonth: new Date().getDate(),
    lastMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate(),
    last3Months: 90,
    thisYear:
      Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000) + 1,
  };
  return map[mode as ReportPeriod] ?? 30;
}

export default function ReportsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [mode, setMode] = useState<ReportMode>('thisMonth');
  const [monthYear, setMonthYear] = useState<MonthYear>(currentMonthYear);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const pinchStart = useRef<number | null>(null);
  const pinchFired = useRef(false);

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
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const allTxns = useMemo(
    () => (ledger ? transactionsForSpace(ledger) : []).filter((txn) => txn.type !== 'transfer'),
    [ledger],
  );

  const periodScoped = useMemo(() => {
    if (mode === 'pickMonth') {
      return allTxns.filter((txn) => inMonthYear(txn.occurredAt, monthYear));
    }
    return filterTransactionsByPeriod(allTxns, mode);
  }, [allTxns, mode, monthYear]);

  const categoryOptions = useMemo(() => {
    if (!ledger) return [];
    const ids = new Set<string>();
    for (const txn of periodScoped) {
      if (txn.type === 'expense' && txn.categoryId) ids.add(txn.categoryId);
    }
    return [...ids]
      .map((id) => ({ id, name: categoryName(ledger, id, locale) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [periodScoped, ledger, locale]);

  const filtered = useMemo(
    () => filterByCategory(periodScoped, categoryId),
    [periodScoped, categoryId],
  );

  const totals = computePeriodTotals(filtered, currency);
  const savesMinor = totals.netMinor;
  const flowTotal = Math.max(1, totals.incomeMinor + totals.expenseMinor);
  const incomeShare = totals.incomeMinor / flowTotal;
  const expenseShare = totals.expenseMinor / flowTotal;
  const days = daysInRange(mode, monthYear, filtered.length, filtered);
  const avgDaily = Math.round(totals.expenseMinor / days);
  const txnCount = filtered.filter((t) => t.status === 'confirmed').length;

  const breakdown = useMemo(() => {
    if (!ledger) return [];
    return categoryBreakdown(
      filtered,
      currency,
      (id) => (id ? categoryName(ledger, id, locale) : t(locale, 'reports.other')),
      'expense',
    );
  }, [filtered, ledger, currency, locale]);

  const hours = useMemo(
    () => spendingByHourOfDay(filtered, currency, tz),
    [filtered, currency, tz],
  );

  const trend = useMemo(() => {
    const scopedAll = filterByCategory(allTxns, categoryId);
    if (mode === 'pickMonth') {
      return incomeExpenseTrend(scopedAll, currency, 'thisMonth').filter((p) => {
        const d = new Date(p.date);
        return d.getMonth() === monthYear.month && d.getFullYear() === monthYear.year;
      });
    }
    return incomeExpenseTrend(scopedAll, currency, mode);
  }, [allTxns, categoryId, currency, mode, monthYear]);

  const busiest = useMemo(() => busiestSpendingHour(filtered, tz), [filtered, tz]);
  const weekday = useMemo(() => highestSpendingWeekday(filtered, tz), [filtered, tz]);
  const topCategory = breakdown[0] ?? null;

  const fileSuffix =
    mode === 'pickMonth'
      ? `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}`
      : mode;

  const onPinchStart = (e: NativeSyntheticEvent<{ touches: NativeTouchEvent[] }>) => {
    pinchStart.current = pinchDistance(e.nativeEvent.touches);
    pinchFired.current = false;
  };

  const onPinchMove = (e: NativeSyntheticEvent<{ touches: NativeTouchEvent[] }>) => {
    if (mode === 'pickMonth' || pinchFired.current || pinchStart.current == null) return;
    const d = pinchDistance(e.nativeEvent.touches);
    if (d == null) return;
    const ratio = d / pinchStart.current;
    if (ratio > 1.25) {
      setMode(zoomPeriod(mode, 'in'));
      pinchFired.current = true;
    } else if (ratio < 0.8) {
      setMode(zoomPeriod(mode, 'out'));
      pinchFired.current = true;
    }
  };

  const hasData = filtered.some((t) => t.status === 'confirmed');

  return (
    <View style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'nav.reports')}</Text>
            <Text style={[styles.subtitle, { color: colors.inkSecondary }]}>
              {t(locale, 'reports.overview')}
            </Text>
          </View>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
        >
          {PERIOD_CHIPS.map((chip) => {
            const active = mode === chip.value;
            return (
              <Pressable
                key={chip.value}
                onPress={() => setMode(chip.value)}
                style={[
                  styles.periodChip,
                  {
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandTint : colors.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.brand : colors.inkSecondary,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {t(locale, chip.labelKey)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setMode('pickMonth')}
            style={[
              styles.periodChip,
              {
                borderColor: mode === 'pickMonth' ? colors.brand : colors.border,
                backgroundColor: mode === 'pickMonth' ? colors.brandTint : colors.surface,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={mode === 'pickMonth' ? colors.brand : colors.inkSecondary}
            />
            <Text
              style={{
                color: mode === 'pickMonth' ? colors.brand : colors.inkSecondary,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {t(locale, 'app.pickMonth')}
            </Text>
          </Pressable>
        </ScrollView>

        {mode === 'pickMonth' ? (
          <MonthYearFilter value={monthYear} onChange={setMonthYear} />
        ) : null}

        <CategoryFilter
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
          locale={locale}
        />

        {!ledger ? (
          <Text style={{ color: colors.inkSecondary }}>{t(locale, 'reports.empty')}</Text>
        ) : !hasData ? (
          <View
            style={[
              styles.emptyCard,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: colors.brandTint }]}>
              <Ionicons name="analytics-outline" size={28} color={colors.brand} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>
              {t(locale, 'reports.empty')}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.inkSecondary }]}>
              {t(locale, 'app.emptyCta')}
            </Text>
            <Pressable
              onPress={() => router.push('/add-transaction')}
              style={[styles.emptyCta, { backgroundColor: colors.brand }]}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>{t(locale, 'nav.add')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.hero,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.heroLabel, { color: colors.inkSecondary }]}>
                {t(locale, 'app.saves')}
              </Text>
              <Text
                style={[
                  styles.heroValue,
                  { color: savesMinor >= 0 ? colors.income : colors.expense },
                ]}
              >
                {formatMinorUnits(savesMinor, currency, locale)}
              </Text>

              <View style={[styles.flowTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.flowIncome,
                    { flex: Math.max(0.04, incomeShare), backgroundColor: colors.income },
                  ]}
                />
                <View
                  style={[
                    styles.flowExpense,
                    { flex: Math.max(0.04, expenseShare), backgroundColor: colors.expense },
                  ]}
                />
              </View>
              <View style={styles.flowLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                  <Text style={{ color: colors.inkSecondary, fontSize: 12 }}>
                    {t(locale, 'home.income')}{' '}
                    <Text style={{ color: colors.ink, fontWeight: '700' }}>
                      {formatMinorUnits(totals.incomeMinor, currency, locale)}
                    </Text>
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
                  <Text style={{ color: colors.inkSecondary, fontSize: 12 }}>
                    {t(locale, 'home.expense')}{' '}
                    <Text style={{ color: colors.ink, fontWeight: '700' }}>
                      {formatMinorUnits(totals.expenseMinor, currency, locale)}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View
                style={[
                  styles.metricCard,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Ionicons name="flash-outline" size={16} color={colors.warning} />
                <Text style={[styles.metricLabel, { color: colors.inkMuted }]}>
                  {t(locale, 'reports.avgDaily')}
                </Text>
                <Text style={[styles.metricValue, { color: colors.ink }]}>
                  {formatMinorUnits(avgDaily, currency, locale)}
                </Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Ionicons name="receipt-outline" size={16} color={colors.info} />
                <Text style={[styles.metricLabel, { color: colors.inkMuted }]}>
                  {t(locale, 'nav.activity')}
                </Text>
                <Text style={[styles.metricValue, { color: colors.ink }]}>{txnCount}</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.insightRow}
            >
              {topCategory ? (
                <View
                  style={[
                    styles.insightCard,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.insightEyebrow, { color: colors.brand }]}>
                    {t(locale, 'reports.topCategory')}
                  </Text>
                  <Text style={[styles.insightTitle, { color: colors.ink }]} numberOfLines={1}>
                    {topCategory.name}
                  </Text>
                  <Text style={{ color: colors.inkSecondary, fontSize: 13 }}>
                    {formatMinorUnits(topCategory.amountMinor, currency, locale)}
                    {topCategory.share > 0
                      ? ` · ${Math.round(topCategory.share * 100)}%`
                      : ''}
                  </Text>
                </View>
              ) : null}
              {busiest.kind === 'busiest_hour' ? (
                <View
                  style={[
                    styles.insightCard,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.insightEyebrow, { color: colors.info }]}>
                    {t(locale, 'reports.busiestHour')}
                  </Text>
                  <Text style={[styles.insightTitle, { color: colors.ink }]} numberOfLines={2}>
                    {busiest.message}
                  </Text>
                </View>
              ) : null}
              {weekday.kind === 'highest_weekday' ? (
                <View
                  style={[
                    styles.insightCard,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.insightEyebrow, { color: colors.warning }]}>
                    {t(locale, 'reports.highestWeekday')}
                  </Text>
                  <Text style={[styles.insightTitle, { color: colors.ink }]} numberOfLines={2}>
                    {weekday.message}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.panel,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              onTouchStart={onPinchStart}
              onTouchMove={onPinchMove}
              onTouchEnd={() => {
                pinchStart.current = null;
                pinchFired.current = false;
              }}
            >
              <View style={styles.panelHead}>
                <Text style={[styles.section, { color: colors.ink }]}>
                  {t(locale, 'reports.trend')}
                </Text>
                <Text style={[styles.hint, { color: colors.inkMuted }]}>
                  {t(locale, 'reports.pinchHint')}
                </Text>
              </View>
              <TrendBars points={trend} currency={currency} locale={locale} />
            </View>

            <View
              style={[
                styles.panel,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.section, { color: colors.ink }]}>
                {t(locale, 'app.categories')}
              </Text>
              <CategoryBreakdown
                items={breakdown.map((c) => ({ name: c.name, amountMinor: c.amountMinor }))}
                currency={currency}
                locale={locale}
              />
            </View>

            <View
              style={[
                styles.panel,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.section, { color: colors.ink }]}>
                {t(locale, 'reports.timeOfDay')}
              </Text>
              <HourBars hours={hours} currency={currency} locale={locale} />
            </View>

            <View style={styles.summary}>
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
    paddingTop: space[5],
    paddingBottom: 180,
    gap: space[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[3],
  },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { marginTop: 4, fontSize: 13 },
  periodRow: { flexDirection: 'row', gap: space[2], paddingVertical: 2 },
  periodChip: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hero: {
    borderRadius: radius.feature,
    borderWidth: 1,
    padding: space[5],
    gap: space[3],
  },
  heroLabel: { fontSize: 13, fontWeight: '600' },
  heroValue: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  flowTrack: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  flowIncome: { height: 10 },
  flowExpense: { height: 10 },
  flowLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    justifyContent: 'space-between',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  metricRow: { flexDirection: 'row', gap: space[3] },
  metricCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
    gap: 6,
  },
  metricLabel: { fontSize: 12, fontWeight: '500' },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  insightRow: { gap: space[3], paddingVertical: 2 },
  insightCard: {
    width: 200,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
    gap: 6,
  },
  insightEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  insightTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  panel: { borderRadius: radius.card, borderWidth: 1, padding: space[5] },
  panelHead: { marginBottom: space[3], gap: 4 },
  section: { fontSize: 16, fontWeight: '700', marginBottom: space[2] },
  hint: { fontSize: 11 },
  summary: { gap: space[3] },
  emptyCard: {
    borderRadius: radius.feature,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: space[6],
    alignItems: 'center',
    gap: space[3],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    marginTop: space[2],
    minHeight: 44,
    borderRadius: radius.control,
    paddingHorizontal: space[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
