import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { CURRENCY_CATALOG } from '@clear-money/domain';
import { SetupShell } from '../../src/components/SetupShell';
import { SetupNavRow } from '../../src/components/SetupNavRow';
import { useSetupLocale } from '../../src/lib/setup-locale';
import { loadSetupSession, markSetupStep, saveSetupSession } from '../../src/lib/setup-session';
import { nextSetupRoute } from '../../src/lib/setup-steps';
import { colors, radius, space } from '../../src/theme/tokens';

export default function CurrencyScreen() {
  const router = useRouter();
  const { t } = useSetupLocale();
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadSetupSession().then((s) => setCurrency(s.currency || 'USD'));
  }, []);

  const filtered = useMemo(
    () =>
      CURRENCY_CATALOG.filter(
        (c) =>
          c.code.toLowerCase().includes(query.toLowerCase()) ||
          c.name.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 12),
    [query],
  );

  return (
    <SetupShell stepId="currency">
      <Text style={styles.title}>{t('setup.currencyTitle')}</Text>
      <Text style={styles.body}>{t('setup.currencyBody')}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('setup.currencySearch')}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />
      <ScrollView style={styles.list} nestedScrollEnabled>
        {filtered.map((c) => {
          const on = currency === c.code;
          return (
            <Pressable
              key={c.code}
              onPress={() => setCurrency(c.code)}
              style={[styles.row, on && styles.rowOn]}
            >
              <Text style={[styles.rowText, on && styles.rowTextOn]}>
                {c.code} · {c.name}
              </Text>
              <Text style={styles.symbol}>{c.symbol}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ height: space[4] }} />
      <SetupNavRow
        stepId="currency"
        onContinue={async () => {
          await saveSetupSession({ currency });
          await markSetupStep('currency');
          router.push(nextSetupRoute('currency') as Href);
        }}
      />
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: colors.inkSecondary, marginBottom: space[4] },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    backgroundColor: colors.surface,
    color: colors.ink,
    marginBottom: space[3],
  },
  list: { maxHeight: 280 },
  row: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
    marginBottom: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  rowText: { fontSize: 14, color: colors.ink, flex: 1 },
  rowTextOn: { color: colors.brand, fontWeight: '600' },
  symbol: { color: colors.inkMuted, marginLeft: space[2] },
});
