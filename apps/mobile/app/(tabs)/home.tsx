import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  computePeriodTotals,
  formatMinorUnits,
  type LedgerTransaction,
} from '@clear-money/domain';
import { t } from '@clear-money/i18n';
import { Body, Title } from '../../src/components/ui';
import { loadSetupSession } from '../../src/lib/setup-session';
import { offlineQueue, offlineStore } from '../../src/offline/client';
import { colors, radius, space } from '../../src/theme/tokens';

export default function HomeScreen() {
  const [locale, setLocale] = useState('en');
  const [currency, setCurrency] = useState('USD');
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const setup = await loadSetupSession();
        setLocale(setup.locale);
        setCurrency(setup.currency);
        // Best-effort sync so returning to Home picks up server confirms.
        await offlineQueue.reconcile().catch(() => undefined);
        const rows = await offlineStore.list();
        setLedger(
          rows
            .filter((row) => row.status === 'confirmed' || row.status === 'pending_sync')
            .map((row) => ({
              id: row.id,
              spaceId: row.spaceId,
              type: row.type,
              amountMinor: row.amountMinor,
              currency: row.currency,
              categoryId: row.categoryId,
              description: row.description,
              occurredAt: row.occurredAt,
              createdAt: row.createdAt,
              createdBy: 'local',
              source: 'manual' as const,
              // Include pending_sync in period totals for immediate local feedback.
              status: 'confirmed' as const,
            })),
        );
      })();
    }, []),
  );

  const totals = computePeriodTotals(ledger, currency);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>{t(locale, 'brand.name')}</Text>
        <Title>{t(locale, 'home.title')}</Title>
        {ledger.length === 0 ? <Body>{t(locale, 'home.empty')}</Body> : null}

        <View style={styles.row}>
          <SummaryCard
            label={t(locale, 'home.net')}
            value={formatMinorUnits(totals.netMinor, currency, locale)}
          />
          <SummaryCard
            label={t(locale, 'home.income')}
            value={formatMinorUnits(totals.incomeMinor, currency, locale)}
            tone="income"
          />
          <SummaryCard
            label={t(locale, 'home.expense')}
            value={formatMinorUnits(totals.expenseMinor, currency, locale)}
            tone="expense"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'income' | 'expense';
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text
        style={[
          styles.cardValue,
          tone === 'income' && { color: colors.income },
          tone === 'expense' && { color: colors.expense },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space[6], paddingBottom: space[12] },
  brand: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: space[2],
    letterSpacing: 0.4,
  },
  row: { gap: space[3] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  cardLabel: { color: colors.inkSecondary, fontSize: 13, marginBottom: space[1] },
  cardValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
