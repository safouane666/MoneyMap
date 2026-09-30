import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CURRENCY_CATALOG, SHIPPED_LOCALES } from '@clear-money/domain';
import { t } from '../src/lib/i18n';
import { apiFetch } from '../src/lib/api';
import { loadLedger, updateSpace } from '../src/lib/ledger';
import { clearSession } from '../src/lib/session';
import {
  loadSetupSession,
  saveSetupSession,
  type SetupLanguage,
} from '../src/lib/setup-session';
import { useSetThemeMode, useThemeColors, useThemeMode } from '../src/theme/ThemeContext';
import { radius, space } from '../src/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const theme = useThemeMode();
  const setTheme = useSetThemeMode();
  const [locale, setLocale] = useState<SetupLanguage>('en');
  const [currency, setCurrency] = useState('USD');
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const refresh = useCallback(async () => {
    const setup = await loadSetupSession();
    setLocale(setup.language);
    setNotify(setup.notificationsEnabled);
    const ledger = await loadLedger().catch(() => null);
    setSignedIn(Boolean(ledger && ledger.userId !== 'guest'));
    const space = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
    setSpaceId(space?.id ?? null);
    setCurrency(space?.currency ?? setup.currency);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'nav.settings')}</Text>

      <Card title={t(locale, 'settings.appearance')}>
        <View style={styles.row}>
          <Text style={{ color: colors.ink }}>{theme === 'dark' ? t(locale, 'settings.theme.dark') : t(locale, 'settings.theme.light')}</Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={(on) => setTheme(on ? 'dark' : 'light')}
            trackColor={{ true: colors.brand }}
          />
        </View>
      </Card>

      <Card title={t(locale, 'settings.language')}>
        <Text style={[styles.label, { color: colors.inkSecondary }]}>{t(locale, 'setup.language.title')}</Text>
        <View style={styles.chips}>
          {SHIPPED_LOCALES.map((l) => {
            const on = locale === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => {
                  const next = l.code as SetupLanguage;
                  setLocale(next);
                  void saveSetupSession({ language: next });
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: on ? colors.brand : colors.border,
                    backgroundColor: on ? colors.brandTint : colors.canvas,
                  },
                ]}
              >
                <Text style={{ color: on ? colors.brand : colors.ink, fontWeight: '600' }}>{l.nativeName}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: colors.inkSecondary }]}>{t(locale, 'settings.currency')}</Text>
        <View style={styles.chips}>
          {CURRENCY_CATALOG.slice(0, 12).map((c) => {
            const on = currency === c.code;
            return (
              <Pressable
                key={c.code}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    if (!spaceId || c.code === currency) {
                      setCurrency(c.code);
                      await saveSetupSession({ currency: c.code });
                      return;
                    }
                    setBusy(true);
                    try {
                      await updateSpace(spaceId, { currency: c.code });
                      await saveSetupSession({ currency: c.code });
                      setCurrency(c.code);
                    } catch {
                      Alert.alert(t(locale, 'settings.currencyFailed'));
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: on ? colors.brand : colors.border,
                    backgroundColor: on ? colors.brandTint : colors.canvas,
                  },
                ]}
              >
                <Text style={{ color: on ? colors.brand : colors.ink, fontWeight: '600' }}>{c.code}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title={t(locale, 'settings.notifications')}>
        <View style={styles.row}>
          <Text style={{ color: colors.ink, flex: 1 }}>{t(locale, 'notifications.enable')}</Text>
          <Switch
            value={notify}
            onValueChange={(on) => {
              setNotify(on);
              void (async () => {
                await saveSetupSession({ notificationsEnabled: on });
                if (on) {
                  const { enableNotificationsAndBurst } = await import(
                    '../src/notifications/sync'
                  );
                  const ok = await enableNotificationsAndBurst();
                  if (!ok) Alert.alert(t(locale, 'notifications.permissionDenied'));
                } else {
                  const { syncNotifications } = await import('../src/notifications/sync');
                  await syncNotifications();
                }
              })();
            }}
            trackColor={{ true: colors.brand }}
          />
        </View>
        {notify ? (
          <Pressable
            onPress={() => {
              void (async () => {
                const { enableNotificationsAndBurst } = await import(
                  '../src/notifications/sync'
                );
                const ok = await enableNotificationsAndBurst();
                if (!ok) {
                  Alert.alert(t(locale, 'notifications.permissionDenied'));
                  return;
                }
                Alert.alert(
                  t(locale, 'notifications.sendTest'),
                  t(locale, 'notifications.sendTestHint'),
                );
              })();
            }}
          >
            <Text style={{ color: colors.brand, fontWeight: '600' }}>
              {t(locale, 'notifications.sendTest')}
            </Text>
            <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 4 }}>
              {t(locale, 'notifications.sendTestHint')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void Linking.openSettings()}>
          <Text style={{ color: colors.brand, fontWeight: '600' }}>System settings</Text>
        </Pressable>
      </Card>

      {signedIn ? (
        <>
          <Card title={t(locale, 'settings.billing')}>
            <Text style={{ color: colors.inkSecondary, fontSize: 14, lineHeight: 20 }}>
              {t(locale, 'billing.betaNoCheckout')}
            </Text>
          </Card>
          <Card title={t(locale, 'settings.privacy')}>
            <Pressable
              disabled={busy}
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const res = await apiFetch('/account/export');
                    if (!res.ok) throw new Error(t(locale, 'settings.exportFailed'));
                    const data = await res.json();
                    await Share.share({
                      message: JSON.stringify(data, null, 2),
                      title: 'clear-money-export.json',
                    });
                  } catch (err) {
                    Alert.alert(
                      t(locale, 'settings.exportFailed'),
                      err instanceof Error ? err.message : undefined,
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              style={[styles.outline, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{t(locale, 'settings.exportData')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Alert.alert(t(locale, 'settings.deleteAccount'), t(locale, 'settings.deleteConfirm'), [
                  { text: t(locale, 'txn.discard'), style: 'cancel' },
                  {
                    text: t(locale, 'app.delete'),
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const res = await apiFetch('/account/delete', { method: 'POST', body: '{}' });
                          if (!res.ok) throw new Error(t(locale, 'settings.deleteFailed'));
                          await apiFetch('/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined);
                          await clearSession();
                          router.replace('/auth/sign-in');
                        } catch (err) {
                          Alert.alert(
                            t(locale, 'settings.deleteFailed'),
                            err instanceof Error ? err.message : undefined,
                          );
                          setBusy(false);
                        }
                      })();
                    },
                  },
                ]);
              }}
            >
              <Text style={{ color: colors.expense, fontWeight: '700' }}>{t(locale, 'settings.deleteAccount')}</Text>
            </Pressable>
          </Card>
          <Pressable
            onPress={() => {
              void (async () => {
                await apiFetch('/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined);
                await clearSession();
                router.replace('/auth/sign-in?skip=1');
              })();
            }}
            style={[styles.outline, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.ink, fontWeight: '600', textAlign: 'center' }}>
              {t(locale, 'settings.signOut')}
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], paddingBottom: space[12], gap: space[4] },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space[5], gap: space[3] },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  label: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  outline: {
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[4],
    justifyContent: 'center',
  },
});
