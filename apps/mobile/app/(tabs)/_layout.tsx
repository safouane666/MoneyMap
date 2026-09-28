import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, touchTarget } from '../../src/theme/tokens';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home', tabBarLabel: 'Home' }} />
        <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarLabel: 'Activity' }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarLabel: 'Reports' }} />
        <Tabs.Screen name="spaces" options={{ title: 'Spaces', tabBarLabel: 'Spaces' }} />
      </Tabs>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={() => router.push('/add-transaction')}
        style={[styles.fab, { bottom: 64 + insets.bottom }]}
      >
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space[6],
    width: touchTarget + 8,
    height: touchTarget + 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#101828',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
});
