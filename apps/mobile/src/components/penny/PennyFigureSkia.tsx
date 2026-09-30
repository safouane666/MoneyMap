import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RoundedRect,
  Skia,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  PENNY_STATE_META,
  toKitState,
  type PennyEyes,
  type PennyMouth,
  type PennyPose,
  type PennyStateMeta,
} from './penny-states';

/** Web Penny palette / geometry (viewBox ~ 200×200, center 100,100). */
const INK = '#1A1F36';
const GOLD = '#F7D060';
const INDIGO = '#5B5CE2';
const SHADE = '#E9BC42';
const RIM = '#D9A62E';
const STAR =
  'M0 -8 Q1.6 -1.6 8 0 Q1.6 1.6 0 8 Q-1.6 1.6 -8 0 Q-1.6 -1.6 0 -8Z';

function usePath(d: string) {
  return useMemo(() => Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make(), [d]);
}

function Eyes({ kind }: { kind: PennyEyes }) {
  const L = 85;
  const R = 115;
  const y = 97;
  const arcUpL = usePath(`M${L - 6} ${y + 2} Q${L} ${y - 5} ${L + 6} ${y + 2}`);
  const arcUpR = usePath(`M${R - 6} ${y + 2} Q${R} ${y - 5} ${R + 6} ${y + 2}`);
  const arcDownL = usePath(`M${L - 6} ${y} Q${L} ${y + 4.5} ${L + 6} ${y}`);
  const arcDownR = usePath(`M${R - 6} ${y} Q${R} ${y + 4.5} ${R + 6} ${y}`);
  const brows = usePath('M77 84 L92 81 M108 81 L123 84');

  const stroke = { strokeWidth: 3, style: 'stroke' as const, strokeCap: 'round' as const };

  switch (kind) {
    case 'happy':
      return (
        <Group>
          <Path path={arcUpL} color={INK} {...stroke} />
          <Path path={arcUpR} color={INK} {...stroke} />
        </Group>
      );
    case 'wink':
      return (
        <Group>
          <RoundedRect x={L - 4.5} y={y - 7} width={9} height={14} r={4.5} color={INK} />
          <Path path={arcUpR} color={INK} {...stroke} />
        </Group>
      );
    case 'closed':
      return (
        <Group>
          <Path path={arcDownL} color={INK} {...stroke} />
          <Path path={arcDownR} color={INK} {...stroke} />
        </Group>
      );
    case 'up':
      return (
        <Group>
          <RoundedRect x={L + 1 - 4.5} y={y - 4 - 6} width={9} height={12} r={4.5} color={INK} />
          <RoundedRect x={R + 1 - 4.5} y={y - 4 - 6} width={9} height={12} r={4.5} color={INK} />
        </Group>
      );
    case 'alert':
      return (
        <Group>
          <RoundedRect x={L - 4.5} y={y + 1 - 5.5} width={9} height={11} r={4.5} color={INK} />
          <RoundedRect x={R - 4.5} y={y + 1 - 5.5} width={9} height={11} r={4.5} color={INK} />
          <Path path={brows} color={INK} strokeWidth={2.8} style="stroke" strokeCap="round" />
        </Group>
      );
    default:
      return (
        <Group>
          <RoundedRect x={L - 4.5} y={y - 7} width={9} height={14} r={4.5} color={INK} />
          <RoundedRect x={R - 4.5} y={y - 7} width={9} height={14} r={4.5} color={INK} />
        </Group>
      );
  }
}

function Mouth({ kind }: { kind: PennyMouth }) {
  const smile = usePath('M90.5 117 Q100 125 109.5 117');
  const flat = usePath('M94 119 L106 119');
  const side = usePath('M94 119.5 Q101 119 107 116');
  const open = usePath('M91 116 Q100 127 109 116 Q100 118.5 91 116Z');
  const stroke = { strokeWidth: 3, style: 'stroke' as const, strokeCap: 'round' as const };

  switch (kind) {
    case 'open':
      return <Path path={open} color={INK} />;
    case 'flat':
      return <Path path={flat} color={INK} {...stroke} />;
    case 'side':
      return <Path path={side} color={INK} {...stroke} />;
    case 'osmall':
      return <Circle cx={100} cy={118} r={2.75} color={INK} />;
    case 'talk':
      return <Circle cx={100} cy={119} r={4.8} color={INK} />;
    default:
      return <Path path={smile} color={INK} {...stroke} />;
  }
}

function CoinBody({ compact }: { compact?: boolean }) {
  const ticks = useMemo(() => {
    if (compact) return null;
    let d = '';
    for (let i = 0; i < 60; i++) {
      const a = ((i * 6) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      d += `M${(100 + 58.5 * c).toFixed(1)} ${(100 + 58.5 * s).toFixed(1)} L${(100 + 62.5 * c).toFixed(1)} ${(100 + 62.5 * s).toFixed(1)} `;
    }
    return Skia.Path.MakeFromSVGString(d);
  }, [compact]);
  const glint = usePath('M54 76 A52 52 0 0 1 76 52');

  return (
    <Group>
      <Circle cx={100} cy={100} r={64} color={SHADE} />
      <Circle cx={95} cy={94} r={62} color={GOLD} />
      {ticks ? (
        <Path path={ticks} color={RIM} style="stroke" strokeWidth={1.5} opacity={0.8} />
      ) : null}
      {!compact ? (
        <Circle
          cx={100}
          cy={100}
          r={55}
          color={RIM}
          style="stroke"
          strokeWidth={1.6}
          opacity={0.85}
        />
      ) : null}
      <Path
        path={glint}
        color="#FFFFFF"
        style="stroke"
        strokeWidth={4}
        strokeCap="round"
        opacity={0.6}
      />
      <Circle cx={100} cy={100} r={64} color={INK} style="stroke" strokeWidth={3} />
    </Group>
  );
}

function Orbit({ half }: { half: 'back' | 'front' }) {
  const d = half === 'back' ? 'M8 100 A92 24 0 0 1 192 100' : 'M192 100 A92 24 0 0 1 8 100';
  const path = usePath(d);
  const back = half === 'back';
  return (
    <Group opacity={back ? 0.45 : 1}>
      <Path path={path} color={INDIGO} style="stroke" strokeWidth={3} strokeCap="round" />
      <Path
        path={path}
        color="#FFFFFF"
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
        opacity={back ? 0.4 : 0.95}
        strokeJoin="round"
      />
    </Group>
  );
}

function StarAt({ x, y, scale = 1, fill = GOLD }: { x: number; y: number; scale?: number; fill?: string }) {
  const star = usePath(STAR);
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { scale }]}>
      <Path path={star} color={fill} />
      <Path path={star} color={INK} style="stroke" strokeWidth={1.8} />
    </Group>
  );
}

function PropsLayer({ list }: { list?: PennyStateMeta['props'] }) {
  const bubble = usePath(
    'M-22 -13 H22 A12 12 0 0 1 22 11 H-6 L-14 19 L-13 11 H-22 A12 12 0 0 1 -22 -13Z',
  );
  const check = usePath('M-6 0.5 L-1.8 4.8 L6.5 -4.8');
  const badgeLine = usePath('M0 -6 V1.5');
  const zzz = usePath('M-5 -6 H5 L-5 6 H5');
  const heart = usePath('M0 7 C-13 -2 -8 -13 0 -6 C8 -13 13 -2 0 7Z');

  if (!list?.length) return null;

  return (
    <Group>
      {list.includes('dots') ? (
        <Group>
          <Circle cx={160} cy={44} r={3} color={INDIGO} />
          <Circle cx={172} cy={31} r={4.2} color={INDIGO} />
          <Circle cx={186} cy={16} r={5.6} color={INDIGO} />
        </Group>
      ) : null}
      {list.includes('spark1') ? <StarAt x={188} y={52} scale={0.8} /> : null}
      {list.includes('sparks') ? (
        <Group>
          <StarAt x={16} y={38} />
          <StarAt x={188} y={46} scale={0.8} fill="#FFFFFF" />
          <StarAt x={50} y={6} scale={0.6} />
          <StarAt x={158} y={8} scale={0.7} fill="#FFFFFF" />
        </Group>
      ) : null}
      {list.includes('check') ? (
        <Group transform={[{ translateX: 168 }, { translateY: 34 }]}>
          <Circle cx={0} cy={0} r={14} color={INDIGO} />
          <Circle cx={0} cy={0} r={14} color={INK} style="stroke" strokeWidth={2.6} />
          <Path path={check} color="#FFFFFF" style="stroke" strokeWidth={3.4} strokeCap="round" strokeJoin="round" />
        </Group>
      ) : null}
      {list.includes('badge') ? (
        <Group transform={[{ translateX: 168 }, { translateY: 34 }]}>
          <Circle cx={0} cy={0} r={14} color={INDIGO} />
          <Circle cx={0} cy={0} r={14} color={INK} style="stroke" strokeWidth={2.6} />
          <Path path={badgeLine} color="#FFFFFF" style="stroke" strokeWidth={3.4} strokeCap="round" />
          <Circle cx={0} cy={6.2} r={2} color="#FFFFFF" />
        </Group>
      ) : null}
      {list.includes('zzz') ? (
        <Group>
          {(
            [
              [148, 40, 0.7],
              [162, 24, 0.9],
              [178, 6, 1.1],
            ] as const
          ).map(([x, y, s]) => (
            <Group key={`z-${x}`} transform={[{ translateX: x }, { translateY: y }, { scale: s }]}>
              <Path path={zzz} color={INDIGO} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" />
            </Group>
          ))}
        </Group>
      ) : null}
      {list.includes('hearts') ? (
        <Group>
          {(
            [
              [166, 40, 1],
              [32, 46, 0.8],
              [188, 78, 0.65],
            ] as const
          ).map(([x, y, s]) => (
            <Group key={`h-${x}`} transform={[{ translateX: x }, { translateY: y }, { scale: s }]}>
              <Path path={heart} color="#FF7A8A" />
              <Path path={heart} color={INK} style="stroke" strokeWidth={2.2} strokeJoin="round" />
            </Group>
          ))}
        </Group>
      ) : null}
      {list.includes('bubble') ? (
        <Group transform={[{ translateX: 166 }, { translateY: 30 }]}>
          <Path path={bubble} color="#FFFFFF" />
          <Path path={bubble} color={INK} style="stroke" strokeWidth={2.4} strokeJoin="round" />
          <Circle cx={-10} cy={-1} r={3.2} color={INDIGO} />
          <Circle cx={0} cy={-1} r={3.2} color={INDIGO} />
          <Circle cx={10} cy={-1} r={3.2} color={INDIGO} />
        </Group>
      ) : null}
    </Group>
  );
}

function CurrencyFace({ text }: { text: string }) {
  const font = useMemo(
    () =>
      matchFont({
        fontFamily: 'System',
        fontSize: text.length > 1 ? 46 : 64,
        fontWeight: '800',
      }),
    [text],
  );
  if (!font) return null;
  const width = font.measureText(text).width;
  return (
    <SkiaText
      x={100 - width / 2}
      y={102 + font.getSize() * 0.35}
      text={text}
      font={font}
      color="#E4AE2F"
    />
  );
}

export function PennyFigureSkia({
  pose = 'idle',
  size = 128,
  compact,
  title,
}: {
  pose?: PennyPose;
  size?: number;
  compact?: boolean;
  title?: string;
}) {
  const kit = toKitState(pose);
  const meta = PENNY_STATE_META[kit];
  const symbols = meta.symbols;

  const floatY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const doTilt = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-4, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    const tilting = kit === 'hello' || kit === 'goal' || kit === 'thanks' || kit === 'think';
    doTilt.value = tilting ? 1 : 0;
    if (kit === 'hello' || kit === 'goal' || kit === 'thanks') {
      rotate.value = withRepeat(
        withSequence(withTiming(4, { duration: 450 }), withTiming(-4, { duration: 450 })),
        -1,
        true,
      );
    } else if (kit === 'think') {
      rotate.value = withRepeat(
        withTiming(-3, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      rotate.value = withTiming(0, { duration: 280 });
    }
    if (kit === 'saved' || kit === 'goal') {
      scale.value = withSequence(
        withTiming(1.06, { duration: 140 }),
        withTiming(0.98, { duration: 120 }),
        withTiming(1, { duration: 120 }),
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [kit, floatY, rotate, scale, doTilt]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${doTilt.value ? rotate.value : 0}deg` },
      { scale: scale.value },
    ],
  }));

  // Match web viewBox: compact '0 20 200 180' else '-20 -10 240 230'
  const vbX = compact ? 0 : -20;
  const vbY = compact ? 20 : -10;
  const vbW = compact ? 200 : 240;
  const vbH = compact ? 180 : 230;

  return (
    <Animated.View
      style={[{ width: size, height: size }, motionStyle]}
      accessibilityLabel={title ?? `Penny, ${kit}`}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group
          transform={[
            { translateX: (-vbX * size) / vbW },
            { translateY: (-vbY * size) / vbH },
            { scaleX: size / vbW },
            { scaleY: size / vbH },
          ]}
        >
          <Orbit half="back" />
          <CoinBody compact={compact} />
          {symbols?.length ? (
            <CurrencyFace text={symbols[0]!} />
          ) : (
            <Group>
              <Eyes kind={meta.eyes} />
              <Mouth kind={meta.mouth} />
            </Group>
          )}
          <Orbit half="front" />
          {!compact ? <PropsLayer list={meta.props} /> : null}
        </Group>
      </Canvas>
    </Animated.View>
  );
}

export function PennyAvatarSkia({
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
  return (
    <View style={styles.avatar}>
      <PennyFigureSkia pose={pose} size={px} compact={compact} title={name} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
