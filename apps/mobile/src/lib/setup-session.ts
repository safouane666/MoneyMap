import AsyncStorage from '@react-native-async-storage/async-storage';
import { firstIncompleteRoute, SETUP_STEPS, type SetupStepId } from './setup-steps';

const KEY = 'cm.setup.session';

export type SetupLanguage = 'en' | 'fr' | 'ar';

export interface SetupSession {
  language: SetupLanguage;
  currency: string;
  notificationsEnabled: boolean;
  completedSteps: string[];
  welcomeSeen: boolean;
  companionSeen: boolean;
}

export const DEFAULT_SETUP: SetupSession = {
  language: 'en',
  currency: 'USD',
  notificationsEnabled: true,
  completedSteps: [],
  welcomeSeen: false,
  companionSeen: false,
};

export async function loadSetupSession(): Promise<SetupSession> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_SETUP };
  try {
    return { ...DEFAULT_SETUP, ...(JSON.parse(raw) as Partial<SetupSession>) };
  } catch {
    return { ...DEFAULT_SETUP };
  }
}

export async function saveSetupSession(
  patch: Partial<SetupSession>,
): Promise<SetupSession> {
  const current = await loadSetupSession();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function markSetupStep(step: SetupStepId | string): Promise<SetupSession> {
  const current = await loadSetupSession();
  const completedSteps = current.completedSteps.includes(step)
    ? current.completedSteps
    : [...current.completedSteps, step];
  return saveSetupSession({ completedSteps });
}

export async function getSetupResumePath(): Promise<string> {
  const session = await loadSetupSession();
  return firstIncompleteRoute(session.completedSteps);
}

export async function isSetupComplete(): Promise<boolean> {
  const session = await loadSetupSession();
  return SETUP_STEPS.every((s) => session.completedSteps.includes(s));
}

export async function clearSetupSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
