import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../src/components/Toast';
import { ThemeProvider, useThemeColors, useThemeMode } from '../src/theme/ThemeContext';

function ThemedStack() {
  const colors = useThemeColors();
  const mode = useThemeMode();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ title: 'Sign in', headerShown: false }} />
        <Stack.Screen name="auth/sign-up" options={{ title: 'Sign up', headerShown: false }} />
        <Stack.Screen
          name="auth/callback"
          options={{ title: 'Signing in', headerShown: false }}
        />
        <Stack.Screen name="penny" options={{ title: 'Penny', headerShown: false, presentation: 'modal' }} />
        <Stack.Screen
          name="add-transaction"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerShown: false }} />
        <Stack.Screen name="space/[id]" options={{ title: 'Space' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    let stopReconcile: (() => void) | undefined;
    let stopNotifications: (() => void) | undefined;
    void (async () => {
      try {
        const { initSentry } = await import('../src/lib/sentry');
        initSentry();
        const { offlineQueue } = await import('../src/offline/client');
        const { startReconcileOnReconnect } = await import(
          '../src/offline/reconcile-on-reconnect'
        );
        stopReconcile = startReconcileOnReconnect(offlineQueue);
        const { startNotificationLifecycle } = await import('../src/notifications/sync');
        stopNotifications = startNotificationLifecycle();
      } catch (err) {
        console.warn('[boot] deferred init failed', err);
      }
    })();
    return () => {
      stopReconcile?.();
      stopNotifications?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <ThemedStack />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
