import { firstIncompletePath, type SetupStepId } from '@/lib/setup-steps';

export type SetupLanguage = 'en' | 'fr' | 'ar';

export interface SetupSession {
  language: SetupLanguage;
  currency: string;
  notificationsEnabled: boolean;
  completedSteps: string[];
  welcomeSeen: boolean;
  companionSeen: boolean;
}

const KEY = 'cm.setup.session';

export const DEFAULT_SETUP: SetupSession = {
  language: 'en',
  currency: 'USD',
  notificationsEnabled: true,
  completedSteps: [],
  welcomeSeen: false,
  companionSeen: false,
};

export function loadSetupSession(): SetupSession {
  if (typeof window === 'undefined') return { ...DEFAULT_SETUP };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETUP };
    return { ...DEFAULT_SETUP, ...(JSON.parse(raw) as Partial<SetupSession>) };
  } catch {
    return { ...DEFAULT_SETUP };
  }
}

export function saveSetupSession(patch: Partial<SetupSession>): SetupSession {
  const next = { ...loadSetupSession(), ...patch };
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  return next;
}

export function markSetupStep(step: SetupStepId | string): SetupSession {
  const current = loadSetupSession();
  const completedSteps = current.completedSteps.includes(step)
    ? current.completedSteps
    : [...current.completedSteps, step];
  return saveSetupSession({ completedSteps });
}

export function getSetupResumePath(): string {
  return firstIncompletePath(loadSetupSession().completedSteps);
}

export function clearSetupSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY);
  }
}
