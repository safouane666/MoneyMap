import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { saveSetupSession } from '../../src/lib/setup-session';
import { colors, space } from '../../src/theme/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flex: 1, padding: space[6], justifyContent: 'center' }}>
        <Title>Clear Money</Title>
        <Body>One ledger. Multiple spaces. Clear money.</Body>
        <PrimaryButton
          label="Get started"
          onPress={async () => {
            await saveSetupSession({ step: 'language' });
            router.push('/setup/language');
          }}
        />
        <View style={{ height: space[3] }} />
        <SecondaryButton label="Sign in" onPress={() => router.push('/auth/sign-in')} />
        <Text style={{ marginTop: space[4], color: colors.inkMuted, fontSize: 13 }}>
          Notification permission is never requested on this screen.
        </Text>
      </View>
    </SafeAreaView>
  );
}
