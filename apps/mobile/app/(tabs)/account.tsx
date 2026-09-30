import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { t } from '../../src/lib/i18n';
import { apiFetch } from '../../src/lib/api';
import { loadLedger, type MobileLedger } from '../../src/lib/ledger';
import { clearSession } from '../../src/lib/session';
import { loadSetupSession } from '../../src/lib/setup-session';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, space } from '../../src/theme/tokens';

type Usage = { used: number; limit: number; remaining: number; plan: string };

export default function AccountScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLocale((await loadSetupSession()).language);
        const data = await loadLedger().catch(() => null);
        setLedger(data);
        if (data && data.userId !== 'guest') {
          const res = await apiFetch('/ai/usage');
          if (res.ok) setUsage((await res.json()) as Usage);
          else setUsage(null);
        } else {
          setUsage(null);
        }
      })();
    }, []),
  );

  const guest = !ledger || ledger.userId === 'guest';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'account.title')}</Text>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>{t(locale, 'account.status')}</Text>
        {guest ? (
          <>
            <Text style={{ color: colors.inkSecondary, fontSize: 14, lineHeight: 20 }}>
              {t(locale, 'account.demoBody')}
            </Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => router.push('/auth/sign-in')}
                style={[styles.btn, { backgroundColor: colors.brand }]}
              >
                <Text style={styles.btnLight}>{t(locale, 'nav.signIn')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/auth/sign-up')}
                style={[styles.outline, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{t(locale, 'nav.signUp')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: colors.brandTint }]}>
                <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 12 }}>
                  {t(locale, 'account.signedIn')}
                </Text>
              </View>
              <Text style={{ color: colors.inkSecondary, textTransform: 'capitalize' }}>
                {ledger.plan ?? 'free'}
              </Text>
            </View>
            <Text style={{ color: colors.ink, fontWeight: '600' }}>
              {ledger.userName || ledger.userEmail}
            </Text>
            <Text style={{ color: colors.inkSecondary }}>{ledger.userEmail}</Text>
            {usage ? (
              <Text style={{ color: colors.inkSecondary, fontSize: 14 }}>
                {t(locale, 'account.pennyCredits', {
                  remaining: usage.remaining,
                  limit: usage.limit,
                })}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Pressable
                disabled={signingOut}
                onPress={() => {
                  void (async () => {
                    setSigningOut(true);
                    await apiFetch('/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined);
                    await clearSession();
                    router.replace('/auth/sign-in?skip=1');
                  })();
                }}
                style={[styles.outline, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.ink, fontWeight: '600' }}>
                  {signingOut ? t(locale, 'settings.signingOut') : t(locale, 'settings.signOut')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={[styles.btn, { backgroundColor: colors.brandTint }]}
              >
                <Text style={{ color: colors.brand, fontWeight: '700' }}>{t(locale, 'nav.settings')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {!guest ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t(locale, 'settings.billing')}</Text>
          <Text style={{ color: colors.inkSecondary, fontSize: 14, lineHeight: 20 }}>
            {t(locale, 'billing.betaNoCheckout')}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={() => router.push('/(tabs)/reports')}>
        <Text style={{ color: colors.brand, fontWeight: '600' }}>{t(locale, 'nav.reports')} ↗</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: 180, gap: space[4] },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space[5], gap: space[3] },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  badge: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 4 },
  btn: { minHeight: 40, borderRadius: radius.control, paddingHorizontal: space[4], justifyContent: 'center' },
  btnLight: { color: '#fff', fontWeight: '700' },
  outline: {
    minHeight: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[4],
    justifyContent: 'center',
  },
});
