import { type ReactNode, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';

const ACTION_WIDTH = 88;
const COMMIT_RATIO = 0.55;

/** PanResponder swipe (no reanimated) — safe in Expo Go New Arch. */
export function SwipeableActivityRow({
  children,
  onHide,
  onDelete,
  locale = 'en',
}: {
  children: ReactNode;
  onHide: () => void;
  onDelete: () => void;
  locale?: string;
}) {
  const colors = useThemeColors();
  const offset = useRef(new Animated.Value(0)).current;
  const start = useRef(0);

  const clamp = (value: number) => Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, value));

  const commit = (next: number) => {
    if (next <= -ACTION_WIDTH * COMMIT_RATIO) {
      Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      onDelete();
      return;
    }
    if (next >= ACTION_WIDTH * COMMIT_RATIO) {
      Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      onHide();
      return;
    }
    const snap =
      next < -ACTION_WIDTH * 0.35
        ? -ACTION_WIDTH
        : next > ACTION_WIDTH * 0.35
          ? ACTION_WIDTH
          : 0;
    Animated.timing(offset, { toValue: snap, duration: 160, useNativeDriver: true }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        offset.stopAnimation((v) => {
          start.current = typeof v === 'number' ? v : 0;
        });
      },
      onPanResponderMove: (_, g) => {
        offset.setValue(clamp(start.current + g.dx));
      },
      onPanResponderRelease: (_, g) => {
        commit(clamp(start.current + g.dx));
      },
      onPanResponderTerminate: (_, g) => {
        commit(clamp(start.current + g.dx));
      },
    }),
  ).current;

  return (
    <View style={styles.clip}>
      <View style={styles.actions} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'app.hide')}
          onPress={() => {
            Animated.timing(offset, { toValue: 0, duration: 120, useNativeDriver: true }).start();
            onHide();
          }}
          style={[styles.action, { backgroundColor: colors.inkSecondary }]}
        >
          <Ionicons name="eye-off-outline" size={16} color="#fff" />
          <Text style={styles.actionLabel}>{t(locale, 'app.hide')}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'app.delete')}
          onPress={() => {
            Animated.timing(offset, { toValue: 0, duration: 120, useNativeDriver: true }).start();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: colors.expense }]}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.actionLabel}>{t(locale, 'app.delete')}</Text>
        </Pressable>
      </View>
      <Animated.View
        style={[{ backgroundColor: colors.surface }, { transform: [{ translateX: offset }] }]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
