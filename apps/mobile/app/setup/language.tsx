import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PrimaryButton, Title } from '../../src/components/ui';
import { saveSetupSession } from '../../src/lib/setup-session';
import { colors, radius, space } from '../../src/theme/tokens';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export default function LanguageScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space[6] }}>
      <Title>Choose your language</Title>
      <Body>You can change this later in Settings.</Body>
      {LANGS.map((l) => (
        <Pressable
          key={l.code}
          onPress={async () => {
            await saveSetupSession({ locale: l.code, step: 'currency' });
            router.push('/setup/currency');
          }}
          style={{
            minHeight: 48,
            borderRadius: radius.control,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: space[4],
            justifyContent: 'center',
            marginBottom: space[3],
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 16 }}>{l.label}</Text>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={() => router.push('/setup/currency')} />
    </SafeAreaView>
  );
}
