import { useRouter } from 'expo-router';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { colors, radius, space } from '../../src/theme/tokens';
import { useState } from 'react';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
        placeholder="Email"
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
        placeholder="Password"
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
      <PrimaryButton label="Sign in" onPress={() => router.replace('/(tabs)/home')} />
      <View style={{ height: space[3] }} />
      <SecondaryButton label="Create account" onPress={() => router.push('/auth/sign-up')} />
    </SafeAreaView>
  );
}
