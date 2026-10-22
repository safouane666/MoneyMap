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

/**
 * Swipe reveals action buttons; the user must tap a button to trigger.
 * Swipe back (or tap elsewhere) snaps the row closed.
 */
export function SwipeableActivityRow({
  children,
  onEdit,
  onArchive,
  locale = 'en',
}: {
  children: ReactNode;
  onEdit: () => void;
  onArchive: () => void;
  locale?: string;
}) {
  const colors = useThemeColors();
  const offset = useRef(new Animated.Value(0)).current;
  const start = useRef(0);

  const clamp = (value: number) => Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, value));

  const snap = (next: number) => {
    const target =
      next < -ACTION_WIDTH * 0.35
        ? -ACTION_WIDTH
        : next > ACTION_WIDTH * 0.35
          ? ACTION_WIDTH
          : 0;
    Animated.timing(offset, { toValue: target, duration: 160, useNativeDriver: true }).start();
  };

  const close = () => {
    Animated.timing(offset, { toValue: 0, duration: 120, useNativeDriver: true }).start();
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
        snap(clamp(start.current + g.dx));
      },
      onPanResponderTerminate: (_, g) => {
        snap(clamp(start.current + g.dx));
      },
    }),
  ).current;

  return (
    <View style={styles.clip}>
      <View style={styles.actions} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'app.edit')}
          onPress={() => {
            close();
            onEdit();
          }}
          style={[styles.action, { backgroundColor: colors.info }]}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.actionLabel}>{t(locale, 'app.edit')}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'app.archive')}
          onPress={() => {
            close();
            onArchive();
          }}
          style={[styles.action, { backgroundColor: colors.inkSecondary }]}
        >
          <Ionicons name="archive-outline" size={16} color="#fff" />
          <Text style={styles.actionLabel}>{t(locale, 'app.archive')}</Text>
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
