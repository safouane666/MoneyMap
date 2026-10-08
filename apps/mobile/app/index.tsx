import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { getSessionCookie } from '../src/lib/session';
import { apiFetch } from '../src/lib/api';
import { getSetupResumePath, isSetupComplete } from '../src/lib/setup-session';
import { colors, space } from '../src/theme/tokens';

/**
 * Native boot (mirrors web /app/boot):
 * loading → setup (first run) → sign-in/skip → tabs
 * signed-in → tabs
 */
export default function Index() {
  const router = useRouter();
  const [hint, setHint] = useState('Loading…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cookie = await getSessionCookie();
        if (cookie) {
          setHint('Checking account…');
          const res = await apiFetch('/me');
          if (!cancelled && res.ok) {
            router.replace('/(tabs)/home' as Href);
            return;
          }
        }

        if (!(await isSetupComplete())) {
          setHint('Opening setup…');
          const path = await getSetupResumePath();
          if (!cancelled) router.replace(path as Href);
          return;
        }

        setHint('Sign in or continue…');
        if (!cancelled) {
          router.replace('/auth/sign-in?skip=1' as Href);
        }
      } catch {
        if (!cancelled) router.replace('/setup/language' as Href);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Penny</Text>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    gap: space[3],
    padding: space[6],
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 13, color: colors.inkMuted },
});
