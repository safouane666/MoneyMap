import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackdrop } from './AuroraBackdrop';
import { PennyCompanion } from './PennyCompanion';
import { SETUP_STEP_META, type SetupPose, type SetupStepId } from '../lib/setup-steps';
import { colors, space } from '../theme/tokens';

/** Mirrors web SetupShell: aurora, brand, progress, Penny, content. */
export function SetupShell({
  stepId,
  children,
  pose: poseOverride,
  bubble: bubbleOverride,
}: {
  stepId: SetupStepId;
  children: React.ReactNode;
  pose?: SetupPose;
  bubble?: string;
}) {
  const meta = SETUP_STEP_META[stepId];
  const total = 6;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AuroraBackdrop />

      <View style={styles.header}>
        <Text style={styles.brand}>Penny</Text>
        <Text style={styles.stepLabel}>
          {meta.step}/{total}
        </Text>
      </View>
      <View style={styles.progress} accessibilityRole="progressbar">
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.bar, i < meta.step ? styles.barOn : styles.barOff]}
          />
        ))}
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PennyCompanion
          pose={poseOverride ?? meta.pose}
          bubble={bubbleOverride ?? meta.bubble}
        />
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  stepLabel: {
    fontSize: 13,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space[4],
    marginTop: space[4],
  },
  bar: { flex: 1, height: 6, borderRadius: 999 },
  barOn: { backgroundColor: colors.brand },
  barOff: { backgroundColor: colors.border },
  scroll: {
    paddingHorizontal: space[4],
    paddingTop: space[6],
    paddingBottom: space[8],
  },
  content: { gap: space[3] },
});
