import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PennyPose } from './penny/penny-states';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, shadow, space } from '../theme/tokens';

export type ToastPayload = {
  message: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  fromPenny?: boolean;
  pose?: PennyPose;
};

type ToastCtx = {
  showToast: (payload: ToastPayload) => void;
  showPennyTip: (payload: Omit<ToastPayload, 'fromPenny'> & { message: string }) => void;
};

const Ctx = createContext<ToastCtx>({
  showToast: () => undefined,
  showPennyTip: () => undefined,
});

const DISMISS_DX = 72;

function PennyToastAvatar({ pose, name }: { pose: PennyPose; name: string }) {
  // Lazy — avoid pulling reanimated/svg into every route via Toast at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PennyAvatar } = require('./penny/PennyFigure') as typeof import('./penny/PennyFigure');
  return <PennyAvatar pose={pose} size="nav" name={name} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
    translateX.setValue(0);
    opacity.setValue(1);
  }, [clearTimer, opacity, translateX]);

  const swipeAway = useCallback(
    (direction: number) => {
      clearTimer();
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: direction * 420,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => dismiss());
    },
    [clearTimer, dismiss, opacity, translateX],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
        opacity.setValue(Math.max(0.25, 1 - Math.abs(g.dx) / 220));
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) >= DISMISS_DX || Math.abs(g.vx) > 0.8) {
          swipeAway(g.dx >= 0 ? 1 : -1);
          return;
        }
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      },
    }),
  ).current;

  const showToast = useCallback(
    (payload: ToastPayload) => {
      clearTimer();
      translateX.setValue(0);
      opacity.setValue(1);
      setToast(payload);
      timer.current = setTimeout(() => swipeAway(1), payload.fromPenny ? 7000 : 5000);
    },
    [clearTimer, opacity, swipeAway, translateX],
  );

  const showPennyTip = useCallback(
    (payload: Omit<ToastPayload, 'fromPenny'> & { message: string }) => {
      showToast({ ...payload, fromPenny: true, title: payload.title ?? 'Penny' });
    },
    [showToast],
  );

  const value = useMemo(() => ({ showToast, showPennyTip }), [showToast, showPennyTip]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[styles.wrap, { bottom: Math.max(insets.bottom, space[4]) + 72 }]}
        >
          <Animated.View
            {...pan.panHandlers}
            style={[
              styles.card,
              shadow.fab,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity,
                transform: [{ translateX }],
              },
              toast.fromPenny && styles.pennyCard,
            ]}
          >
            {toast.fromPenny ? (
              <PennyToastAvatar pose={toast.pose ?? 'hello'} name={toast.title ?? 'Penny'} />
            ) : null}
            <Pressable style={{ flex: 1, minWidth: 0 }} onPress={dismiss}>
              {toast.title ? (
                <Text style={[styles.title, { color: colors.ink }]}>{toast.title}</Text>
              ) : null}
              <Text style={[styles.message, { color: colors.inkSecondary }]}>{toast.message}</Text>
            </Pressable>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  dismiss();
                }}
                hitSlop={8}
              >
                <Text style={[styles.action, { color: colors.brand }]}>{toast.actionLabel}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss">
                <Text style={[styles.dismiss, { color: colors.inkMuted }]}>✕</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  return useContext(Ctx);
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    zIndex: 80,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  pennyCard: { alignItems: 'flex-start' },
  title: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  message: { fontSize: 13, lineHeight: 18 },
  action: { fontSize: 13, fontWeight: '700' },
  dismiss: { fontSize: 16, fontWeight: '600', paddingHorizontal: 4 },
});
