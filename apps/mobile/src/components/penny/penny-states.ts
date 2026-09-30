import type { SetupPose } from '../../lib/setup-steps';

/** States from the Penny motion kit (orbit coin, no limbs). */
export type PennyKitState =
  | 'idle'
  | 'hello'
  | 'think'
  | 'answer'
  | 'flip'
  | 'goal'
  | 'saved'
  | 'alert'
  | 'sleep'
  | 'roll'
  | 'thanks';

/** App-facing poses (setup + UI). Maps onto kit states. */
export type PennyPose = SetupPose | PennyKitState;

export const SETUP_POSE_TO_KIT: Record<SetupPose, PennyKitState> = {
  idle: 'idle',
  wave: 'hello',
  think: 'think',
  cheer: 'goal',
};

export function toKitState(pose: PennyPose): PennyKitState {
  if (pose in SETUP_POSE_TO_KIT) return SETUP_POSE_TO_KIT[pose as SetupPose];
  return pose as PennyKitState;
}

export type PennyEyes = 'calm' | 'happy' | 'wink' | 'closed' | 'up' | 'alert';
export type PennyMouth = 'smile' | 'open' | 'flat' | 'side' | 'osmall' | 'talk';

export interface PennyStateMeta {
  id: PennyKitState;
  eyes: PennyEyes;
  mouth: PennyMouth;
  brows?: boolean;
  props?: Array<'dots' | 'bubble' | 'spark1' | 'sparks' | 'check' | 'badge' | 'zzz' | 'hearts'>;
  symbols?: string[];
}

export const PENNY_STATE_META: Record<PennyKitState, PennyStateMeta> = {
  idle: { id: 'idle', eyes: 'calm', mouth: 'smile' },
  hello: { id: 'hello', eyes: 'wink', mouth: 'smile', props: ['spark1'] },
  think: { id: 'think', eyes: 'up', mouth: 'side', props: ['dots'] },
  answer: { id: 'answer', eyes: 'calm', mouth: 'talk', props: ['bubble'] },
  flip: { id: 'flip', eyes: 'calm', mouth: 'smile' },
  goal: { id: 'goal', eyes: 'happy', mouth: 'open', props: ['sparks'] },
  saved: { id: 'saved', eyes: 'happy', mouth: 'smile', props: ['check'] },
  alert: { id: 'alert', eyes: 'alert', mouth: 'flat', brows: true, props: ['badge'] },
  sleep: { id: 'sleep', eyes: 'closed', mouth: 'osmall', props: ['zzz'] },
  roll: {
    id: 'roll',
    eyes: 'calm',
    mouth: 'smile',
    symbols: ['$', '€', '£', '¥', '₹', 'DT'],
  },
  thanks: { id: 'thanks', eyes: 'happy', mouth: 'smile', props: ['hearts'] },
};
