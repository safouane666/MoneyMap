import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackdrop } from '../../src/components/AuroraBackdrop';
import { GoogleSignInButton } from '../../src/components/GoogleSignInButton';
import { PennyAvatar } from '../../src/components/penny/PennyFigure';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { AuthError, signInWithEmail } from '../../src/lib/auth';
import { useSetupLocale } from '../../src/lib/setup-locale';
import { colors, radius, space } from '../../src/theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useSetupLocale();
  const params = useLocalSearchParams<{ skip?: string }>();
  const allowSkip = params.skip === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuroraBackdrop />
      <Text style={styles.brand}>Penny</Text>
      <View style={styles.penny}>
        <PennyAvatar pose="wave" size="lg" />
      </View>
      <View style={styles.card}>
        <Title>{t('auth.signInTitle')}</Title>
        <Body>{t('auth.signInBody')}</Body>
        <GoogleSignInButton
          migrateGuest={false}
          label={t('auth.google')}
          onSuccess={() => router.replace('/(tabs)/home')}
          onError={setError}
        />
        <Text style={styles.or}>{t('auth.orEmail')}</Text>
        <TextInput
          accessibilityLabel={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder={t('auth.email')}
          placeholderTextColor={colors.inkMuted}
          editable={!loading}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder={t('auth.password')}
          placeholderTextColor={colors.inkMuted}
          editable={!loading}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={loading ? t('auth.signingIn') : t('auth.submitSignIn')}
          onPress={() => void onSubmit()}
        />
        <View style={{ height: space[3] }} />
        <SecondaryButton
          label={t('auth.submitSignUp')}
          onPress={() => router.push('/auth/sign-up')}
        />
        {allowSkip ? (
          <Pressable onPress={() => router.replace('/(tabs)/home')} style={styles.skip}>
            <Text style={styles.skipText}>{t('setup.skipAccount')}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: space[6],
    justifyContent: 'center',
  },
  brand: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: space[3],
  },
  penny: { alignItems: 'center', marginBottom: space[4] },
  card: {
    borderRadius: radius.feature,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space[5],
  },
  or: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 13,
    marginVertical: space[3],
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    marginBottom: space[3],
    color: colors.ink,
    backgroundColor: colors.canvas,
  },
  error: { color: colors.expense, marginBottom: space[3], fontSize: 13 },
  skip: { marginTop: space[4], alignItems: 'center' },
  skipText: { color: colors.brand, fontWeight: '600' },
});
