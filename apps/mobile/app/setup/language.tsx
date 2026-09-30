import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { PrimaryButton } from '../../src/components/ui';
import { markSetupStep, saveSetupSession, type SetupLanguage } from '../../src/lib/setup-session';
import { nextSetupRoute } from '../../src/lib/setup-steps';
import { colors, radius, space } from '../../src/theme/tokens';

const LANGS: Array<{ code: SetupLanguage; label: string; english: string }> = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'fr', label: 'Français', english: 'French' },
  { code: 'ar', label: 'العربية', english: 'Arabic' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<SetupLanguage>('en');

  return (
    <SetupShell stepId="language">
      <Text style={styles.title}>Pick your language</Text>
      <Text style={styles.body}>
        We&apos;ll coach you in the language you choose — change it anytime.
      </Text>
      <View style={styles.list}>
        {LANGS.map((l) => {
          const on = selected === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => setSelected(l.code)}
              style={[styles.card, on && styles.cardOn]}
            >
              <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>{l.label}</Text>
              <Text style={styles.cardSub}>{l.english}</Text>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        label="Continue"
        onPress={async () => {
          await saveSetupSession({ language: selected });
          await markSetupStep('language');
          router.push(nextSetupRoute('language') as Href);
        }}
      />
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: colors.inkSecondary, marginBottom: space[4] },
  list: { gap: space[3], marginBottom: space[6] },
  card: {
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  cardOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.ink },
  cardTitleOn: { color: colors.brand },
  cardSub: { marginTop: 2, fontSize: 13, color: colors.inkMuted },
});
