import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AuroraBackdrop } from '../../src/components/AuroraBackdrop';
import { GoogleSignInButton } from '../../src/components/GoogleSignInButton';
import { PennyAvatar } from '../../src/components/penny/PennyFigure';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { AuthError, signUpWithEmail } from '../../src/lib/auth';
import { useSetupLocale } from '../../src/lib/setup-locale';
import { colors, radius, space } from '../../src/theme/tokens';

export default function SignUpScreen() {
  const { t } = useSetupLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail({ name, email, password });
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : t('auth.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuroraBackdrop />
      <Text style={styles.brand}>Penny</Text>
      <View style={styles.penny}>
        <PennyAvatar pose="cheer" size="lg" />
      </View>
      <View style={styles.card}>
        <Title>{t('auth.signUpTitle')}</Title>
        <Body>{t('brand.tagline')}</Body>
        <GoogleSignInButton
          migrateGuest
          label={t('auth.google')}
          onSuccess={() => router.replace('/(tabs)/home')}
          onError={setError}
        />
        <Text style={styles.or}>{t('auth.orEmail')}</Text>
        <View style={styles.form}>
          <TextInput
            accessibilityLabel={t('auth.name')}
            placeholder={t('auth.name')}
            placeholderTextColor={colors.inkMuted}
            value={name}
            onChangeText={setName}
            editable={!loading}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t('auth.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder={t('auth.email')}
            placeholderTextColor={colors.inkMuted}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t('auth.password')}
            secureTextEntry
            autoComplete="new-password"
            placeholder={t('auth.password')}
            placeholderTextColor={colors.inkMuted}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            style={styles.input}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={loading ? t('auth.creating') : t('auth.submitSignUp')}
          onPress={() => void onSubmit()}
        />
        <View style={{ height: space[3] }} />
        <SecondaryButton
          label={t('auth.hasAccount')}
          onPress={() => router.push('/auth/sign-in')}
        />
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
  form: { gap: 0 },
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
});
