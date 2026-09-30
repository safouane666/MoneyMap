import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { PrimaryButton } from '../../src/components/ui';
import { markSetupStep, saveSetupSession } from '../../src/lib/setup-session';
import { nextSetupRoute } from '../../src/lib/setup-steps';
import { colors, radius, space } from '../../src/theme/tokens';

export default function NotificationsScreen() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);

  return (
    <SetupShell stepId="notifications">
      <Text style={styles.title}>Gentle nudges</Text>
      <Text style={styles.body}>
        Optional daily facts and weekly reviews — never spammy, always yours to turn off.
      </Text>
      <Pressable
        onPress={() => setEnabled(true)}
        style={[styles.card, enabled && styles.cardOn]}
      >
        <Text style={[styles.cardTitle, enabled && styles.on]}>Yes, enable reminders</Text>
        <Text style={styles.cardBody}>
          Stay gently aware of spending without opening the app every day.
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setEnabled(false)}
        style={[styles.card, !enabled && styles.cardOn]}
      >
        <Text style={[styles.cardTitle, !enabled && styles.on]}>Not now</Text>
      </Pressable>
      <View style={{ height: space[4] }} />
      <PrimaryButton
        label="Continue"
        onPress={async () => {
          await saveSetupSession({ notificationsEnabled: enabled });
          await markSetupStep('notifications');
          if (enabled) {
            try {
              const { enableNotificationsAndBurst } = await import(
                '../../src/notifications/sync'
              );
              await enableNotificationsAndBurst();
            } catch (err) {
              console.warn('[setup] notification enable failed', err);
            }
          }
          router.push(nextSetupRoute('notifications') as Href);
        }}
      />
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: colors.inkSecondary, marginBottom: space[4] },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space[4],
    marginBottom: space[3],
  },
  cardOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  on: { color: colors.brand },
  cardBody: { marginTop: space[2], fontSize: 14, lineHeight: 20, color: colors.inkSecondary },
});
