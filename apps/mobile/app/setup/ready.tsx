import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { PrimaryButton, SecondaryButton } from '../../src/components/ui';
import { markSetupStep } from '../../src/lib/setup-session';
import { colors, radius, space } from '../../src/theme/tokens';

export default function ReadyScreen() {
  const router = useRouter();
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    void markSetupStep('ready');
    const id = setTimeout(() => setShowCta(true), 700);
    return () => clearTimeout(id);
  }, []);

  return (
    <SetupShell stepId="ready">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>You&apos;re set</Text>
        <Text style={styles.title}>Ready when you are</Text>
        <Text style={styles.body}>
          Create an account to sync across devices, sign in if you already have one, or continue
          without an account.
        </Text>
        {showCta ? (
          <View style={styles.actions}>
            <PrimaryButton label="Get started" onPress={() => router.push('/auth/sign-up')} />
            <SecondaryButton
              label="Sign in"
              onPress={() => router.push('/auth/sign-in?skip=1')}
            />
            <SecondaryButton
              label="Continue without an account"
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
});
