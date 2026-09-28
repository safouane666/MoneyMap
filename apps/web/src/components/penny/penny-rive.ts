/** Contract for the Penny `.riv` file we build together in Rive. */

export const PENNY_RIVE_SRC = '/penny/penny.riv';

/** Exact names to use in the Rive editor (case-sensitive). */
export const PENNY_RIVE = {
  /** Artboard name */
  artboard: 'Penny',
  /** State machine name */
  stateMachine: 'Penny SM',
  /**
   * Number input on the state machine.
   * 0 = idle, 1 = wave, 2 = think, 3 = cheer
   */
  poseInput: 'pose',
} as const;

export const PENNY_POSE_VALUE = {
  idle: 0,
  wave: 1,
  think: 2,
  cheer: 3,
} as const;
