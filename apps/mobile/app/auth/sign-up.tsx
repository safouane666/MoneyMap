import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { t } from '@clear-money/i18n';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { colors, radius, space, touchTarget } from '../../src/theme/tokens';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
          style={styles.input}
        />
        <TextInput
          accessibilityLabel={t('en', 'auth.email')}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t('en', 'auth.email')}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel={t('en', 'auth.password')}
          secureTextEntry
          placeholder={t('en', 'auth.password')}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
      </View>
      <PrimaryButton
        label={t('en', 'auth.submitSignUp')}
        onPress={() => router.replace('/(tabs)/home')}
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
});
