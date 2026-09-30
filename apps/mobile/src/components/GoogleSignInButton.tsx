import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthError, isGoogleAuthEnabled, signInWithGoogle } from '../lib/auth';
import { colors, radius, space, touchTarget } from '../theme/tokens';

export function GoogleSignInButton({
  migrateGuest = false,
  label = 'Continue with Google',
  onSuccess,
  onError,
}: {
  migrateGuest?: boolean;
  label?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isGoogleAuthEnabled().then(setEnabled);
  }, []);

  if (enabled !== true) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          void (async () => {
            if (busy) return;
            setBusy(true);
            try {
              await signInWithGoogle({ migrateGuest });
              onSuccess?.();
            } catch (err) {
              const msg =
                err instanceof AuthError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : 'Google sign-in failed';
              onError?.(msg);
            } finally {
              setBusy(false);
            }
          })();
        }}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }, busy && { opacity: 0.7 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <Text style={styles.g}>G</Text>
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space[3] },
  btn: {
    minHeight: touchTarget,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
  },
  g: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
});
