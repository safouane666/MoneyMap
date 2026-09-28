import { useRouter } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { AuthError, signInWithEmail } from '../../src/lib/auth';
import { colors, radius, space } from '../../src/theme/tokens';
import { useState } from 'react';

export default function SignInScreen() {
  const router = useRouter();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space[6] }}>
      <Title>Sign in</Title>
      <Body>Welcome back to Clear Money.</Body>
      <TextInput
        accessibilityLabel="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="Email"
        editable={!loading}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.control,
          paddingHorizontal: space[4],
          marginBottom: space[3],
          backgroundColor: colors.surface,
        }}
      />
      <TextInput
        accessibilityLabel="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        placeholder="Password"
        editable={!loading}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.control,
          paddingHorizontal: space[4],
          marginBottom: space[4],
          backgroundColor: colors.surface,
        }}
      />
      {error ? (
        <Text style={{ color: colors.expense, marginBottom: space[3] }}>{error}</Text>
      ) : null}
      <PrimaryButton label={loading ? 'Signing in…' : 'Sign in'} onPress={() => void onSubmit()} />
      <View style={{ height: space[3] }} />
      <SecondaryButton label="Create account" onPress={() => router.push('/auth/sign-up')} />
    </SafeAreaView>
  );
}
