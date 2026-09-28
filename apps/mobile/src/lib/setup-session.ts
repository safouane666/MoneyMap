import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cm.localSetupSession';

export interface LocalSetupSession {
  step: 'welcome' | 'language' | 'currency' | 'notifications' | 'intro' | 'done';
  locale: string;
  currency: string;
  notificationsEnabled: boolean | null;
  updatedAt: string;
}

const DEFAULT_SESSION: LocalSetupSession = {
  step: 'welcome',
  locale: 'en',
  currency: 'USD',
  notificationsEnabled: null,
  updatedAt: new Date(0).toISOString(),
};

export async function loadSetupSession(): Promise<LocalSetupSession> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_SESSION };
  try {
    return { ...DEFAULT_SESSION, ...(JSON.parse(raw) as LocalSetupSession) };
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

export async function saveSetupSession(
  patch: Partial<LocalSetupSession>,
): Promise<LocalSetupSession> {
  const current = await loadSetupSession();
  const next: LocalSetupSession = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
