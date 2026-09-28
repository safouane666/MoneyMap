import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { t } from '@clear-money/i18n';
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
      <Title>{t('en', 'auth.signUpTitle')}</Title>
      <Body>{t('en', 'brand.tagline')}</Body>
      <View style={styles.form}>
        <TextInput
          accessibilityLabel={t('en', 'auth.name')}
          placeholder={t('en', 'auth.name')}
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
      <SecondaryButton
        label={t('en', 'auth.hasAccount')}
        onPress={() => router.push('/auth/sign-in')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, padding: space[6] },
  form: { gap: space[3], marginBottom: space[6] },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
    color: colors.ink,
  },
  error: { color: colors.expense, marginBottom: space[3] },
});
