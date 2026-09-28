import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { saveSetupSession } from '../../src/lib/setup-session';
import { colors, space } from '../../src/theme/tokens';

export default function IntroScreen() {
  const router = useRouter();
  const finish = async () => {
    await saveSetupSession({ step: 'done' });
    router.replace('/auth/sign-up');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space[6] }}>
      <Title>You are ready</Title>
      <Body>
        Record money in and out, keep Spaces clear, and see reports and goals — with reminders
        prepared on your device when you want them.
      </Body>
      <PrimaryButton label="Start using Clear Money" onPress={finish} />
      <View style={{ height: space[3] }} />
      <SecondaryButton label="Skip intro" onPress={finish} />
    </SafeAreaView>
  );
}
