export type SetupPose = 'idle' | 'cheer' | 'think' | 'wave';

export type SetupStepId =
  | 'language'
  | 'meet'
  | 'features'
  | 'currency'
  | 'notifications'
  | 'ready';

export const SETUP_STEPS: SetupStepId[] = [
  'language',
  'meet',
  'features',
  'currency',
  'notifications',
  'ready',
];

export const SETUP_STEP_META: Record<
  SetupStepId,
  { pose: SetupPose; bubbleKey: string; path: string; step: number }
> = {
  language: {
    pose: 'wave',
    bubbleKey: 'setup.bubbles.language',
    path: '/setup/language',
    step: 1,
  },
  meet: {
    pose: 'cheer',
    bubbleKey: 'setup.bubbles.meet',
    path: '/setup/meet',
    step: 2,
  },
  features: {
    pose: 'think',
    bubbleKey: 'setup.bubbles.features',
    path: '/setup/features',
    step: 3,
  },
  currency: {
    pose: 'think',
    bubbleKey: 'setup.bubbles.currency',
    path: '/setup/currency',
    step: 4,
  },
  notifications: {
    pose: 'idle',
    bubbleKey: 'setup.bubbles.notifications',
    path: '/setup/notifications',
    step: 5,
  },
  ready: {
    pose: 'cheer',
    bubbleKey: 'setup.bubbles.ready',
    path: '/setup/ready',
    step: 6,
  },
};

export function nextSetupPath(current: SetupStepId): string {
  const idx = SETUP_STEPS.indexOf(current);
  if (idx < 0 || idx >= SETUP_STEPS.length - 1) return '/setup/ready';
  return SETUP_STEP_META[SETUP_STEPS[idx + 1]].path;
}

export function firstIncompletePath(completedSteps: string[]): string {
  for (const id of SETUP_STEPS) {
    if (!completedSteps.includes(id)) return SETUP_STEP_META[id].path;
  }
  return SETUP_STEP_META.ready.path;
}
