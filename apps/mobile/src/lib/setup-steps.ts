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
  { pose: SetupPose; bubble: string; route: string; step: number }
> = {
  language: {
    pose: 'wave',
    bubble: 'Hi! First things first — which language feels natural?',
    route: '/setup/language',
    step: 1,
  },
  meet: {
    pose: 'cheer',
    bubble: "Nice to meet you. I'm Penny. I'll stick with you through setup.",
    route: '/setup/meet',
    step: 2,
  },
  features: {
    pose: 'think',
    bubble: 'Quick tour: ledger, spaces, and a helpful AI sidekick.',
    route: '/setup/features',
    step: 3,
  },
  currency: {
    pose: 'think',
    bubble: 'What should we call “home base” for your money?',
    route: '/setup/currency',
    step: 4,
  },
  notifications: {
    pose: 'idle',
    bubble: 'Want a soft nudge now and then? Totally optional.',
    route: '/setup/notifications',
    step: 5,
  },
  ready: {
    pose: 'cheer',
    bubble: "Boom — you're ready. I'll cheer from the sidelines.",
    route: '/setup/ready',
    step: 6,
  },
};

export function nextSetupRoute(current: SetupStepId): string {
  const idx = SETUP_STEPS.indexOf(current);
  if (idx < 0 || idx >= SETUP_STEPS.length - 1) return SETUP_STEP_META.ready.route;
  return SETUP_STEP_META[SETUP_STEPS[idx + 1]!].route;
}

export function firstIncompleteRoute(completedSteps: string[]): string {
  for (const id of SETUP_STEPS) {
    if (!completedSteps.includes(id)) return SETUP_STEP_META[id].route;
  }
  return SETUP_STEP_META.ready.route;
}
