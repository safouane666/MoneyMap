import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { PrimaryButton, SecondaryButton } from './ui';
import { useSetupLocale } from '../lib/setup-locale';
import { prevSetupRoute, type SetupStepId } from '../lib/setup-steps';
import { space } from '../theme/tokens';

/** Continue (+ optional Back) for setup steps after language. */
export function SetupNavRow({
  stepId,
  onContinue,
  continueLabel,
}: {
  stepId: SetupStepId;
  onContinue: () => void | Promise<void>;
  continueLabel?: string;
}) {
  const router = useRouter();
  const { t } = useSetupLocale();
  const backTo = prevSetupRoute(stepId);

  return (
    <View style={styles.row}>
      {backTo ? (
        <SecondaryButton
          label={t('setup.features.prev')}
          onPress={() => router.replace(backTo as Href)}
        />
      ) : (
        <View style={styles.spacer} />
      )}
      <PrimaryButton
        label={continueLabel ?? t('setup.continue')}
        onPress={() => void onContinue()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[2],
    flexWrap: 'wrap',
  },
  spacer: { flex: 1, minWidth: 48 },
});
