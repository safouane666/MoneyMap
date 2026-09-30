/**
 * Clear Money tokens mirrored for React Native StyleSheet.
 * Source of truth for web: packages/ui-tokens/tokens.css
 */
export const colors = {
  canvas: '#F7F8FA',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  ink: '#101828',
  inkSecondary: '#667085',
  inkMuted: '#98A2B3',
  brand: '#5B5CE2',
  brandTint: '#EEF0FF',
  income: '#159A72',
  expense: '#D95D5D',
  warning: '#C78324',
  ai: '#8B5CF6',
  info: '#3B82F6',
  border: '#E4E7EC',
} as const;

export const colorsDark = {
  canvas: '#0B1020',
  surface: '#121A2B',
  elevated: '#121A2B',
  ink: '#F8FAFC',
  inkSecondary: '#98A2B3',
  inkMuted: '#667085',
  brand: '#5B5CE2',
  brandTint: '#1C1F3A',
  income: '#159A72',
  expense: '#D95D5D',
  warning: '#C78324',
  ai: '#8B5CF6',
  info: '#3B82F6',
  border: '#27334A',
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
} as const;

export const radius = {
  sm: 10,
  control: 12,
  card: 16,
  feature: 20,
  pill: 999,
} as const;

export const motion = {
  fast: 120,
  medium: 200,
  slow: 320,
} as const;

export const touchTarget = 48;

/** Matches web `--cm-shadow` / `.cm-shadow`. */
export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  fab: {
    shadowColor: '#101828',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

export type ThemeColors = {
  canvas: string;
  surface: string;
  elevated: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  brand: string;
  brandTint: string;
  income: string;
  expense: string;
  warning: string;
  ai: string;
  info: string;
  border: string;
};
