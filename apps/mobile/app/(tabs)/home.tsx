import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  computePeriodTotals,
  computeSafeToSpend,
  monthlyTargetMinor,
  type LedgerTransaction,
} from '@clear-money/domain';
import { CategoryBreakdown } from '../../src/components/CategoryBreakdown';
import { GoalCard } from '../../src/components/GoalCard';
import { MonthlyShareCard } from '../../src/components/MonthlyShareCard';
import { PeriodSelector, type Period } from '../../src/components/PeriodSelector';
import { RecurringHomeSection } from '../../src/components/RecurringHomeSection';
import { SummaryCard } from '../../src/components/SummaryCard';
import { ActivityTxnRow } from '../../src/components/ActivityTxnRow';
import { SwipeableActivityRow } from '../../src/components/SwipeableActivityRow';
import { useToast } from '../../src/components/Toast';
import { t } from '../../src/lib/i18n';
import { hideTxnId, loadHiddenTxnIds, unhideTxnId } from '../../src/lib/hidden-txns';
import {
  categoryName,
  deleteTransaction,
  goalsForSpace,
  loadLedger,
  recurringForSpace,
  restoreTransaction,
  visibleTransactionsForSpace,
  type MobileLedger,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { offlineQueue } from '../../src/offline/client';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, shadow, space } from '../../src/theme/tokens';

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

function categoryBreakdown(
  ledger: MobileLedger,
  txns: LedgerTransaction[],
): Array<{ name: string; amountMinor: number }> {
  const map = new Map<string, number>();
  for (const txn of txns) {
    if (txn.type !== 'expense') continue;
    const name = categoryName(ledger, txn.categoryId);
    map.set(name, (map.get(name) ?? 0) + txn.amountMinor);
  }
  return [...map.entries()]
    .map(([name, amountMinor]) => ({ name, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 5);
}

/** Home layout mirrors web `/app/home` (dark AppShell phone layout). */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const setup = await loadSetupSession();
        setLocale(setup.language);
        setHiddenIds(await loadHiddenTxnIds());
        await offlineQueue.reconcile().catch(() => undefined);
        try {
          setLedger(await loadLedger());
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not load');
        }
      })();
    }, []),
  );

  const activeSpace = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
  const currency = activeSpace?.currency ?? 'USD';

  const filtered = useMemo(() => {
    if (!ledger) return [];
    return visibleTransactionsForSpace(ledger, hiddenIds).filter((txn) =>
      inPeriod(txn.occurredAt, period),
    );
  }, [ledger, period, hiddenIds]);

  const totals = useMemo(
    () => computePeriodTotals(filtered, currency),
    [filtered, currency],
  );

  const goals = ledger ? goalsForSpace(ledger) : [];
  const activeGoal = goals.find((g) => g.status === 'active') ?? null;
  const recurring = ledger ? recurringForSpace(ledger) : [];

  const scheduledExpenseMinor = useMemo(
    () =>
      recurring
        .filter((r) => r.kind === 'expense')
        .reduce((sum, r) => sum + r.amountMinor, 0),
    [recurring],
  );

  const safe = useMemo(() => {
    const planned = goals
      .filter((g) => g.status === 'active')
      .reduce(
        (sum, g) =>
          sum +
          (g.plannedContributionMinor > 0
            ? g.plannedContributionMinor
            : monthlyTargetMinor(g)),
        0,
      );
    return computeSafeToSpend({
      incomeMinor: totals.incomeMinor,
      expenseMinor: totals.expenseMinor,
      plannedContributionMinor: planned,
      scheduledExpenseMinor,
      bufferMinor: 0,
      currency,
      hasRequiredInputs: filtered.length > 0 || totals.incomeMinor > 0,
    });
  }, [
    currency,
    filtered.length,
    goals,
    scheduledExpenseMinor,
    totals.expenseMinor,
    totals.incomeMinor,
  ]);

  const recent = filtered.slice(0, 6);
  const breakdown = ledger ? categoryBreakdown(ledger, filtered) : [];

  const periodLabel =
    period === 'thisWeek'
      ? t(locale, 'home.thisWeek')
      : period === 'lastMonth'
        ? t(locale, 'home.lastMonth')
        : t(locale, 'home.thisMonth');

  const guest = !ledger || ledger.userId === 'guest';

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
          void restoreTransaction(txn).then(async () => {
            setLedger(await loadLedger());
          });
        },
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : t(locale, 'errors.generic') });
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title row — same as web: space eyebrow + Home | Period dropdown */}
        <View style={styles.pageHeader}>
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: colors.inkMuted }]} numberOfLines={1}>
              {activeSpace?.name ?? '—'}
            </Text>
            <Text style={[styles.h1, { color: colors.ink }]} numberOfLines={1}>
              {t(locale, 'home.title')}
            </Text>
          </View>
          <PeriodSelector value={period} onChange={setPeriod} locale={locale} />
        </View>

        {guest ? (
          <View
            style={[
              styles.banner,
              {
                borderColor: 'rgba(199,131,36,0.35)',
                backgroundColor: 'rgba(199,131,36,0.12)',
              },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.inkSecondary }]}>
              Continuing without an account — sign in anytime from Account to sync.
            </Text>
            <Pressable onPress={() => router.push('/auth/sign-in')}>
              <Text style={[styles.bannerCta, { color: colors.brand }]}>Sign in</Text>
            </Pressable>
          </View>
        ) : null}
        {ledger?.offline && !guest ? (
          <View
            style={[
              styles.banner,
              {
                borderColor: 'rgba(59,130,246,0.35)',
                backgroundColor: 'rgba(59,130,246,0.12)',
              },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.inkSecondary }]}>
              {t(locale, 'home.offline')}
            </Text>
          </View>
        ) : null}
        {error ? (
          <View
            style={[
              styles.banner,
              {
                borderColor: 'rgba(217,93,93,0.35)',
                backgroundColor: 'rgba(217,93,93,0.12)',
              },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.inkSecondary }]}>{error}</Text>
          </View>
        ) : null}

        <RecurringHomeSection
          items={recurring}
          currency={currency}
          locale={locale}
          spaceId={activeSpace?.id ?? ledger?.activeSpaceId ?? ''}
          signedIn={!guest}
          onChanged={() => {
            void loadLedger()
              .then(setLedger)
              .catch(() => undefined);
          }}
        />

        <View style={styles.summaryBlock}>
          <SummaryCard
            label={t(locale, 'home.safeToSpend')}
            amountMinor={safe.estimateMinor ?? 0}
            currency={currency}
            locale={locale}
            tone="net"
            large
          />
          <Text style={[styles.hint, { color: colors.inkMuted }]}>
            {safe.status === 'insufficient'
              ? t(locale, 'goals.safeToSpendMissing')
              : t(locale, 'home.safeToSpendHint')}
          </Text>
          <View style={styles.summaryStack}>
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
        </View>

        {period === 'thisMonth' ? (
          <MonthlyShareCard
            spentMinor={totals.expenseMinor}
            safeToSpendMinor={safe.estimateMinor}
            currency={currency}
            locale={locale}
            goal={activeGoal}
            periodLabel={periodLabel}
          />
        ) : null}

        <View style={styles.split}>
          <Section
            title={t(locale, 'home.whereWent')}
            actionLabel={t(locale, 'nav.reports')}
            onAction={() => router.push('/(tabs)/reports')}
          >
            <View
              style={[
                styles.panel,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <CategoryBreakdown items={breakdown} currency={currency} locale={locale} />
            </View>
          </Section>

          <Section
            title={t(locale, 'goals.title')}
            actionLabel={t(locale, 'home.viewAll')}
            onAction={() => router.push('/(tabs)/goals')}
          >
            {activeGoal ? (
              <GoalCard goal={activeGoal} locale={locale} />
            ) : (
              <View
                style={[
                  styles.dashed,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.dashedText, { color: colors.inkMuted }]}>
                  {t(locale, 'goals.empty')}
                </Text>
              </View>
            )}
          </Section>
        </View>

        <Section
          title={t(locale, 'home.recent')}
          actionLabel={t(locale, 'home.viewAll')}
          onAction={() => router.push('/(tabs)/activity')}
        >
          {recent.length === 0 ? (
            <View
              style={[
                styles.dashedTall,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.dashedText, { color: colors.inkSecondary }]}>
                {t(locale, 'home.emptyHint')}
              </Text>
              <Text style={[styles.dashedSub, { color: colors.inkMuted }]}>
                {t(locale, 'home.emptyCta')}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.listCard,
                shadow.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              {recent.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    index < recent.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
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
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.inkSecondary }]}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={[styles.sectionAction, { color: colors.brand }]}>
              {actionLabel} ↗
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[6],
    // Clear FAB + tab bar so Safe-to-spend isn't covered (web uses pb-36).
    paddingBottom: 180,
    gap: space[8],
  },
  pageHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
  },
  titleBlock: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
  },
  eyebrow: { fontSize: 14 },
  h1: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  banner: {
    borderRadius: radius.control,
    borderWidth: 1,
    padding: space[4],
    gap: space[2],
  },
  bannerText: { fontSize: 13, lineHeight: 18 },
  bannerCta: { fontSize: 13, fontWeight: '600' },
  summaryBlock: { gap: space[3] },
  hint: { marginTop: -4, fontSize: 12 },
  summaryStack: { gap: space[4] },
  split: { gap: space[8] },
  section: { gap: space[3] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  sectionTitle: { fontSize: 14, fontWeight: '500' },
  sectionAction: { fontSize: 12, fontWeight: '600' },
  panel: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
  },
  dashed: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: space[6],
  },
  dashedTall: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: space[6],
    paddingVertical: space[8],
    alignItems: 'center',
  },
  dashedText: { fontSize: 14, textAlign: 'center' },
  dashedSub: { marginTop: 4, fontSize: 12, textAlign: 'center' },
  listCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  txnTitle: { fontSize: 15, fontWeight: '500' },
  txnMeta: { marginTop: 2, fontSize: 12 },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
