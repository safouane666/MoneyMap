import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as colorsLight, colorsDark, type ThemeColors } from './tokens';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'cm.theme';

const ThemeContext = createContext<{
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}>({
  mode: 'light',
  colors: colorsLight,
  setMode: () => undefined,
});

export function ThemeProvider({
  children,
  mode: forced,
}: {
  children: ReactNode;
  mode?: ThemeMode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(forced ?? 'light');

  useEffect(() => {
    if (forced) {
      setModeState(forced);
      return;
    }
    void AsyncStorage.getItem(THEME_KEY).then((raw) => {
      if (raw === 'dark' || raw === 'light') setModeState(raw);
    });
  }, [forced]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const palette = mode === 'dark' ? colorsDark : colorsLight;
  const value = useMemo(() => ({ mode, colors: palette, setMode }), [mode, palette, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext).mode;
}

export function useSetThemeMode(): (mode: ThemeMode) => void {
  return useContext(ThemeContext).setMode;
}
