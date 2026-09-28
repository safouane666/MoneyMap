import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initSentry } from '../src/lib/sentry';
import { offlineQueue } from '../src/offline/client';
import { startReconcileOnReconnect } from '../src/offline/reconcile-on-reconnect';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
  useEffect(() => {
    initSentry();
    return startReconcileOnReconnect(offlineQueue);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/sign-up" options={{ title: 'Sign up' }} />
        <Stack.Screen
          name="add-transaction"
          options={{ presentation: 'modal', title: 'Add transaction' }}
        />
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
