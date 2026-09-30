import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { computePeriodTotals, formatMinorUnits } from '@clear-money/domain';
import { SpaceMembersPanel } from '../../src/components/SpaceMembersPanel';
import { t } from '../../src/lib/i18n';
import {
  loadLedger,
  setActiveSpaceId,
  transactionsForSpace,
  type MobileLedger,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, space } from '../../src/theme/tokens';

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLocale((await loadSetupSession()).language);
        setLedger(await loadLedger());
      })();
    }, [id]),
  );

  const space = ledger?.spaces.find((s) => s.id === id);
  const txns = ledger && space ? transactionsForSpace(ledger, space.id).filter((t) => t.type !== 'transfer') : [];
  const totals = computePeriodTotals(txns, space?.currency ?? 'USD');
  const recent = txns.slice(0, 5);

  if (!space) {
    return (
      <View style={[styles.box, { backgroundColor: colors.canvas }]}>
        <Text style={{ color: colors.inkSecondary }}>{t(locale, 'spaces.notFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.ink }]}>{space.name}</Text>
          <Text style={[styles.sub, { color: colors.inkSecondary }]}>
            {space.currency} · {space.role}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void setActiveSpaceId(space.id).then(() => router.replace('/(tabs)/home'));
          }}
          style={[styles.open, { backgroundColor: colors.brandTint, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{t(locale, 'spaces.open')}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Mini label={t(locale, 'home.net')} value={formatMinorUnits(totals.netMinor, space.currency, locale)} />
        <Mini
          label={t(locale, 'home.income')}
          value={formatMinorUnits(totals.incomeMinor, space.currency, locale)}
          color={colors.income}
        />
        <Mini
          label={t(locale, 'home.expense')}
          value={formatMinorUnits(totals.expenseMinor, space.currency, locale)}
          color={colors.expense}
        />
      </View>

      <SpaceMembersPanel spaceId={space.id} role={space.role} locale={locale} />

      <Text style={[styles.section, { color: colors.inkSecondary }]}>{t(locale, 'app.recent')}</Text>
      {recent.map((txn) => (
        <View
          key={txn.id}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={{ color: colors.ink, flex: 1 }} numberOfLines={1}>
            {txn.description || t(locale, `txn.${txn.type}`)}
          </Text>
          <Text style={{ color: colors.ink, fontVariant: ['tabular-nums'], fontWeight: '600' }}>
            {formatMinorUnits(txn.amountMinor, txn.currency, locale)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.mini, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.inkSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: color ?? colors.ink, fontSize: 18, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: space[6], justifyContent: 'center' },
  content: { padding: space[4], paddingBottom: space[12], gap: space[4] },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  title: { fontSize: 24, fontWeight: '600' },
  sub: { marginTop: 4, fontSize: 14 },
  open: {
    minHeight: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  grid: { gap: space[3] },
  mini: { borderRadius: radius.card, borderWidth: 1, padding: space[4] },
  section: { fontSize: 14, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
});
