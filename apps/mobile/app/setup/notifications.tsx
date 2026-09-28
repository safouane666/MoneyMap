import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PrimaryButton, SecondaryButton, Title } from '../../src/components/ui';
import { saveSetupSession } from '../../src/lib/setup-session';
import { colors, space } from '../../src/theme/tokens';
import { requestNotificationPermission } from '../../src/notifications/expo-scheduler';

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space[6] }}>
      <Title>Gentle reminders</Title>
      <Body>
        Clear Money can prepare small daily facts, weekly reviews, and goal progress on this device.
        Amounts are hidden on the lock screen by default.
      </Body>
      <PrimaryButton
        label="Enable reminders"
        onPress={async () => {
          await requestNotificationPermission();
          await saveSetupSession({ notificationsEnabled: true, step: 'intro' });
          router.push('/setup/intro');
        }}
      />
      <View style={{ height: space[3] }} />
      <SecondaryButton
        label="Not now"
        onPress={async () => {
          await saveSetupSession({ notificationsEnabled: false, step: 'intro' });
          router.push('/setup/intro');
        }}
      />
    </SafeAreaView>
  );
}
