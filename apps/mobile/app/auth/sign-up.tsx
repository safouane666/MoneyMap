import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { t } from '../../src/lib/i18n';
import { AuroraBackdrop } from '../../src/components/AuroraBackdrop';
import { GoogleSignInButton } from '../../src/components/GoogleSignInButton';
import { PennyAvatar } from '../../src/components/penny/PennyFigure';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { AuthError, signUpWithEmail } from '../../src/lib/auth';
import { colors, radius, space, touchTarget } from '../../src/theme/tokens';

export default function SignUpScreen() {
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
      setError(err instanceof AuthError ? err.message : 'Sign up failed');
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
        <Title>{t('en', 'auth.signUpTitle')}</Title>
        <Body>{t('en', 'brand.tagline')}</Body>
        <GoogleSignInButton
          migrateGuest
          label="Continue with Google"
          onSuccess={() => router.replace('/(tabs)/home')}
          onError={setError}
        />
        <Text style={styles.or}>or email</Text>
        <View style={styles.form}>
          <TextInput
            accessibilityLabel={t('en', 'auth.name')}
            placeholder={t('en', 'auth.name')}
            placeholderTextColor={colors.inkMuted}
            value={name}
            onChangeText={setName}
            editable={!loading}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t('en', 'auth.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder={t('en', 'auth.email')}
            placeholderTextColor={colors.inkMuted}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t('en', 'auth.password')}
            secureTextEntry
            autoComplete="new-password"
            placeholder={t('en', 'auth.password')}
            placeholderTextColor={colors.inkMuted}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            style={styles.input}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={loading ? 'Creating…' : t('en', 'auth.submitSignUp')}
          onPress={() => void onSubmit()}
        />
        <View style={{ height: space[3] }} />
        <SecondaryButton
          label={t('en', 'auth.hasAccount')}
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
  form: { gap: space[3], marginBottom: space[4] },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.canvas,
    paddingHorizontal: space[4],
    color: colors.ink,
  },
  error: { color: colors.expense, marginBottom: space[3] },
  or: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 12,
    marginBottom: space[3],
  },
});
