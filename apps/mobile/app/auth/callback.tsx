import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  migrateGuestLedgerToSpace,
  discardGuestLedger,
} from '../../src/lib/guest-migrate';
import { setPersonalSpaceId, setSessionCookie } from '../../src/lib/session';
import { apiFetch } from '../../src/lib/api';
import { loadSetupSession } from '../../src/lib/setup-session';
import { colors, space } from '../../src/theme/tokens';

/**
 * Deep-link landing after Google OAuth (`penny://auth/callback` /
 * `exp://…/--/auth/callback`). Also used when openAuthSessionAsync returns
 * while the app is backgrounded.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session?: string; migrate?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session =
          typeof params.session === 'string' ? params.session : null;
        if (!session) {
          throw new Error('Missing session from Google sign-in');
        }
        await setSessionCookie(decodeURIComponent(session));

        await apiFetch('/billing/subscribe', {
          method: 'POST',
          body: JSON.stringify({ plan: 'free' }),
        }).catch(() => undefined);

        const setup = await loadSetupSession();
        const setupRes = await apiFetch('/me/setup-complete', {
          method: 'POST',
          body: JSON.stringify({
            locale: setup.language,
            defaultCurrency: setup.currency,
            notificationEnabled: setup.notificationsEnabled,
          }),
        });
        let spaceId: string | undefined;
        if (setupRes.ok) {
          const data = (await setupRes.json()) as { spaceId?: string };
          spaceId = data.spaceId;
        }
        if (!spaceId) {
          const spacesRes = await apiFetch('/spaces');
          if (!spacesRes.ok) throw new Error('Could not load spaces');
          const spaces = (await spacesRes.json()) as Array<{
            id: string;
            type?: string;
          }>;
          spaceId = (spaces.find((s) => s.type === 'personal') ?? spaces[0])?.id;
        }
        if (!spaceId) throw new Error('No personal space');
        await setPersonalSpaceId(spaceId);

        if (params.migrate === '1') {
          await migrateGuestLedgerToSpace(spaceId);
        } else {
          await discardGuestLedger();
        }

        if (!cancelled) router.replace('/(tabs)/home' as Href);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sign-in failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.session, params.migrate, router]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Penny</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.hint}>Finishing Google sign-in…</Text>
        </>
      )}
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
  error: { fontSize: 14, color: colors.expense, textAlign: 'center' },
});
