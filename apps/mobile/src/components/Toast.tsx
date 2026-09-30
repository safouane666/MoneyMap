import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((payload: ToastPayload) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(payload);
    timer.current = setTimeout(() => setToast(null), payload.fromPenny ? 7000 : 5000);
  }, []);

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
          <View
            style={[
              styles.card,
              shadow.fab,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              toast.fromPenny && styles.pennyCard,
            ]}
          >
            {toast.fromPenny ? (
              <PennyToastAvatar pose={toast.pose ?? 'hello'} name={toast.title ?? 'Penny'} />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              {toast.title ? (
                <Text style={[styles.title, { color: colors.ink }]}>{toast.title}</Text>
              ) : null}
              <Text style={[styles.message, { color: colors.inkSecondary }]}>{toast.message}</Text>
            </View>
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
            ) : null}
          </View>
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
});
