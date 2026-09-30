import { StyleSheet, Text, View } from 'react-native';
import { PennyAvatar } from './penny/PennyFigure';
import type { SetupPose } from '../lib/setup-steps';
import { colors, radius, space } from '../theme/tokens';

/** Mirrors web SetupCompanion: Penny avatar + speech bubble (no reanimated — Expo Go safe). */
export function PennyCompanion({
  pose,
  bubble,
  name = 'Penny',
}: {
  pose: SetupPose;
  bubble: string;
  name?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <PennyAvatar pose={pose} size="lg" name={name} />
        <View style={styles.bubble}>
          <View style={styles.tail} />
          <Text style={styles.name}>{name.toUpperCase()}</Text>
          <Text style={styles.bubbleText}>{bubble}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space[5] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  bubble: {
    flex: 1,
    marginTop: space[4],
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    shadowColor: '#1A1F36',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tail: {
    position: 'absolute',
    left: -7,
    top: 18,
    width: 14,
    height: 14,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  name: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.brand,
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    fontWeight: '500',
  },
});
