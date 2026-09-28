import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMinorUnits } from '@clear-money/domain';
import { Body, PrimaryButton, Title } from '../../src/components/ui';
import { loadSetupSession, saveSetupSession } from '../../src/lib/setup-session';
import { colors, space } from '../../src/theme/tokens';
import { useEffect, useState } from 'react';

const CURRENCIES = ['USD', 'EUR', 'TND', 'GBP', 'JPY'];

export default function CurrencyScreen() {
  const router = useRouter();
  const [currency, setCurrency] = useState('USD');
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    void loadSetupSession().then((s) => {
      setCurrency(s.currency);
      setLocale(s.locale);
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space[6] }}>
      <Title>Choose your currency</Title>
      <Body>Default for new entries. Stored amounts are never silently converted.</Body>
      {CURRENCIES.map((code) => (
        <Text
          key={code}
          onPress={() => setCurrency(code)}
          style={{
            paddingVertical: space[3],
            color: currency === code ? colors.brand : colors.ink,
            fontWeight: currency === code ? '700' : '400',
          }}
        >
          {code} — Coffee {formatMinorUnits(1250, code === 'TND' ? 'TND' : code === 'JPY' ? 'JPY' : 'USD', locale)}
        </Text>
      ))}
      <View style={{ flex: 1 }} />
      <PrimaryButton
        label="Continue"
        onPress={async () => {
          await saveSetupSession({ currency, step: 'notifications' });
          router.push('/setup/notifications');
        }}
      />
    </SafeAreaView>
  );
}
