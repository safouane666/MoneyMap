import { Stack } from 'expo-router';
import { SetupLocaleProvider } from '../../src/lib/setup-locale';
import { colors } from '../../src/theme/tokens';

export default function SetupLayout() {
  return (
    <SetupLocaleProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      />
    </SetupLocaleProvider>
  );
}
