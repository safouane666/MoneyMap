import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { SetupNavRow } from '../../src/components/SetupNavRow';
import { useSetupLocale } from '../../src/lib/setup-locale';
import { markSetupStep } from '../../src/lib/setup-session';
import { nextSetupRoute } from '../../src/lib/setup-steps';
import { colors, space } from '../../src/theme/tokens';

export default function MeetScreen() {
  const router = useRouter();
  const { t } = useSetupLocale();
  return (
    <SetupShell stepId="meet">
      <Text style={styles.title}>{t('setup.meetTitle')}</Text>
      <Text style={styles.body}>{t('setup.meetBody')}</Text>
      <SetupNavRow
        stepId="meet"
        continueLabel={t('setup.meetCta')}
        onContinue={async () => {
          await markSetupStep('meet');
          router.push(nextSetupRoute('meet') as Href);
        }}
      />
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: space[2],
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.inkSecondary, marginBottom: space[6] },
});
