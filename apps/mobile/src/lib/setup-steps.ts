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
  { pose: SetupPose; bubbleKey: string; route: string; step: number }
> = {
  language: {
    pose: 'wave',
    bubbleKey: 'setup.bubbles.language',
    route: '/setup/language',
    step: 1,
  },
  meet: {
    pose: 'cheer',
    bubbleKey: 'setup.bubbles.meet',
    route: '/setup/meet',
    step: 2,
  },
  features: {
    pose: 'think',
    bubbleKey: 'setup.bubbles.features',
    route: '/setup/features',
    step: 3,
  },
  currency: {
    pose: 'think',
    bubbleKey: 'setup.bubbles.currency',
    route: '/setup/currency',
    step: 4,
  },
  notifications: {
    pose: 'idle',
    bubbleKey: 'setup.bubbles.notifications',
    route: '/setup/notifications',
    step: 5,
  },
  ready: {
    pose: 'cheer',
    bubbleKey: 'setup.bubbles.ready',
    route: '/setup/ready',
    step: 6,
  },
};

export function nextSetupRoute(current: SetupStepId): string {
  const idx = SETUP_STEPS.indexOf(current);
  if (idx < 0 || idx >= SETUP_STEPS.length - 1) return SETUP_STEP_META.ready.route;
  return SETUP_STEP_META[SETUP_STEPS[idx + 1]!].route;
}

export function prevSetupRoute(current: SetupStepId): string | null {
  const idx = SETUP_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return SETUP_STEP_META[SETUP_STEPS[idx - 1]!].route;
}

export function firstIncompleteRoute(completedSteps: string[]): string {
  for (const id of SETUP_STEPS) {
    if (!completedSteps.includes(id)) return SETUP_STEP_META[id].route;
  }
  return SETUP_STEP_META.ready.route;
}
