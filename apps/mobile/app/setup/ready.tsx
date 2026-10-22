import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { PrimaryButton, SecondaryButton } from '../../src/components/ui';
import { useSetupLocale } from '../../src/lib/setup-locale';
import { markSetupStep } from '../../src/lib/setup-session';
import { prevSetupRoute } from '../../src/lib/setup-steps';
import { colors, radius, space } from '../../src/theme/tokens';

export default function ReadyScreen() {
  const router = useRouter();
  const { t } = useSetupLocale();
  const [showCta, setShowCta] = useState(false);
  const backTo = prevSetupRoute('ready');

  useEffect(() => {
    void markSetupStep('ready');
    const id = setTimeout(() => setShowCta(true), 700);
    return () => clearTimeout(id);
  }, []);

  return (
    <SetupShell stepId="ready">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('setup.celebrationEyebrow')}</Text>
        <Text style={styles.title}>{t('setup.readyTitle')}</Text>
        <Text style={styles.body}>{t('setup.readyBody')}</Text>
        {showCta ? (
          <View style={styles.actions}>
            <View style={styles.navRow}>
              {backTo ? (
                <SecondaryButton
                  label={t('setup.features.prev')}
                  onPress={() => router.replace(backTo as Href)}
                />
              ) : null}
              <PrimaryButton
                label={t('setup.welcome.cta')}
                onPress={() => router.push('/auth/sign-up')}
              />
            </View>
            <SecondaryButton
              label={t('nav.signIn')}
              onPress={() => router.push('/auth/sign-in?skip=1')}
            />
            <SecondaryButton
              label={t('setup.skipAccount')}
              onPress={() => router.replace('/(tabs)/home')}
            />
          </View>
        ) : null}
      </View>
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.feature,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space[5],
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.brand,
  },
  title: {
    marginTop: space[2],
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  body: { marginTop: space[3], fontSize: 15, lineHeight: 22, color: colors.inkSecondary },
  actions: { marginTop: space[6], gap: space[3] },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[3],
  },
});
