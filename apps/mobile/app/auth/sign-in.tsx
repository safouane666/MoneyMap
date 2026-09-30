import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackdrop } from '../../src/components/AuroraBackdrop';
import { GoogleSignInButton } from '../../src/components/GoogleSignInButton';
import { PennyAvatar } from '../../src/components/penny/PennyFigure';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { AuthError, signInWithEmail } from '../../src/lib/auth';
import { colors, radius, space } from '../../src/theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
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
      setError(err instanceof AuthError ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuroraBackdrop />
      <Text style={styles.brand}>Clear Money</Text>
      <View style={styles.penny}>
        <PennyAvatar pose="wave" size="lg" />
      </View>
      <View style={styles.card}>
        <Title>Welcome back</Title>
        <Body>Sign in to sync your spaces across devices.</Body>
        <GoogleSignInButton
          migrateGuest={false}
          onSuccess={() => router.replace('/(tabs)/home')}
          onError={setError}
        />
        <Text style={styles.or}>or email</Text>
        <TextInput
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="Email"
          placeholderTextColor={colors.inkMuted}
          editable={!loading}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="Password"
          placeholderTextColor={colors.inkMuted}
          editable={!loading}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={loading ? 'Signing in…' : 'Sign in'}
          onPress={() => void onSubmit()}
        />
        <View style={{ height: space[3] }} />
        <SecondaryButton label="Create account" onPress={() => router.push('/auth/sign-up')} />
        {allowSkip ? (
          <Pressable onPress={() => router.replace('/(tabs)/home')} style={styles.skip}>
            <Text style={styles.skipText}>Continue without an account</Text>
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
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    marginBottom: space[3],
    backgroundColor: colors.canvas,
    color: colors.ink,
  },
  error: { color: colors.expense, marginBottom: space[3] },
  or: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 12,
    marginBottom: space[3],
  },
  skip: { marginTop: space[4], alignItems: 'center' },
  skipText: { color: colors.brand, fontWeight: '600', fontSize: 14 },
});
