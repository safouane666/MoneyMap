import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { PennyPose } from './penny-states';
import { PennyFigureViews } from './PennyFigureViews';

/**
 * Expo Go New Arch cannot register Fabric natives for RNSVG*
 * ("Codegen didn't run" / "property is not writable"). Use Views there.
 *
 * Custom binaries (EAS APK / expo-dev-client) load SVG and get the web-matching coin.
 */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function PennyFigure(props: {
  pose?: PennyPose;
  size?: number;
  compact?: boolean;
  title?: string;
}) {
  if (!isExpoGo) {
    // Lazy require — never evaluate react-native-svg inside Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PennyFigureSvg } = require('./PennyFigureSvg') as typeof import('./PennyFigureSvg');
    return <PennyFigureSvg {...props} />;
  }
  return <PennyFigureViews {...props} />;
}

export function PennyAvatar({
  pose = 'idle',
  size = 'md',
  name = 'Penny',
}: {
  pose?: PennyPose;
  size?: 'sm' | 'nav' | 'md' | 'lg';
  name?: string;
}) {
  const px = size === 'lg' ? 148 : size === 'md' ? 72 : size === 'nav' ? 48 : 36;
  const compact = size === 'sm' || size === 'nav';
  return <PennyFigure pose={pose} size={px} compact={compact} title={name} />;
}
