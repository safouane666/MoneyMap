import { StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Soft aurora wash without expo-linear-gradient.
 * Expo Go New Arch currently fails LinearGradient native view registration.
 */
export function AuroraBackdrop({ style }: { style?: ViewStyle }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={styles.brandBlob} />
      <View style={styles.goldBlob} />
      <View style={styles.incomeBlob} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlob: {
    position: 'absolute',
    top: -40,
    left: -60,
    width: 280,
    height: 220,
    borderRadius: 140,
    backgroundColor: 'rgba(91,92,226,0.16)',
  },
  goldBlob: {
    position: 'absolute',
    top: -20,
    right: -40,
    width: 200,
    height: 160,
    borderRadius: 100,
    backgroundColor: 'rgba(247,208,96,0.12)',
  },
  incomeBlob: {
    position: 'absolute',
    top: 80,
    left: '30%',
    width: 180,
    height: 140,
    borderRadius: 90,
    backgroundColor: 'rgba(21,154,114,0.07)',
  },
});
