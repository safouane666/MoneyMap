import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
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

/** Same geometry as apps/web PennyFigure — for APK / dev client only. */
const INK = '#1A1F36';
const GOLD = '#F7D060';
const INDIGO = '#5B5CE2';
const SHADE = '#E9BC42';
const RIM = '#D9A62E';
const STAR = 'M0 -8 Q1.6 -1.6 8 0 Q1.6 1.6 0 8 Q-1.6 1.6 -8 0 Q-1.6 -1.6 0 -8Z';

function Eyes({ kind }: { kind: PennyEyes }) {
  const L = 85;
  const R = 115;
  const y = 97;
  const cap = (x: number, yy: number, h: number) => (
    <Rect x={x - 4.5} y={yy - h / 2} width={9} height={h} rx={4.5} fill={INK} />
  );
  const arcUp = (x: number, yy: number) => (
    <Path
      d={`M${x - 6} ${yy + 2} Q${x} ${yy - 5} ${x + 6} ${yy + 2}`}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
  const arcDown = (x: number, yy: number) => (
    <Path
      d={`M${x - 6} ${yy} Q${x} ${yy + 4.5} ${x + 6} ${yy}`}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );

  switch (kind) {
    case 'happy':
      return (
        <G>
          {arcUp(L, y)}
          {arcUp(R, y)}
        </G>
      );
    case 'wink':
      return (
        <G>
          {cap(L, y, 14)}
          {arcUp(R, y)}
        </G>
      );
    case 'closed':
      return (
        <G>
          {arcDown(L, y)}
          {arcDown(R, y)}
        </G>
      );
    case 'up':
      return (
        <G>
          {cap(L + 1, y - 4, 12)}
          {cap(R + 1, y - 4, 12)}
        </G>
      );
    case 'alert':
      return (
        <G>
          {cap(L, y + 1, 11)}
          {cap(R, y + 1, 11)}
          <Path
            d="M77 84 L92 81 M108 81 L123 84"
            fill="none"
            stroke={INK}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
        </G>
      );
    default:
      return (
        <G>
          {cap(L, y, 14)}
          {cap(R, y, 14)}
        </G>
      );
  }
}

function Mouth({ kind }: { kind: PennyMouth }) {
  const s = {
    fill: 'none' as const,
    stroke: INK,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
  };
  switch (kind) {
    case 'open':
      return (
        <Path
          d="M91 116 Q100 127 109 116 Q100 118.5 91 116Z"
          fill={INK}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      );
    case 'flat':
      return <Path d="M94 119 L106 119" {...s} />;
    case 'side':
      return <Path d="M94 119.5 Q101 119 107 116" {...s} />;
    case 'osmall':
      return <Ellipse cx={100} cy={118} rx={3} ry={2.5} fill={INK} />;
    case 'talk':
      return <Ellipse cx={100} cy={119} rx={5.5} ry={4.2} fill={INK} />;
    default:
      return <Path d="M90.5 117 Q100 125 109.5 117" {...s} />;
  }
}

function CoinBody({ clipId, compact }: { clipId: string; compact?: boolean }) {
  const ticks = useMemo(() => {
    if (compact) return '';
    let d = '';
    for (let i = 0; i < 60; i++) {
      const a = ((i * 6) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      d += `M${(100 + 58.5 * c).toFixed(1)} ${(100 + 58.5 * s).toFixed(1)} L${(100 + 62.5 * c).toFixed(1)} ${(100 + 62.5 * s).toFixed(1)} `;
    }
    return d;
  }, [compact]);

  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={100} cy={100} r={64} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={100} cy={100} r={64} fill={SHADE} />
        <Circle cx={95} cy={94} r={62} fill={GOLD} />
      </G>
      {!compact && ticks ? (
        <Path d={ticks} stroke={RIM} strokeWidth={1.5} opacity={0.8} />
      ) : null}
      {!compact ? (
        <Circle cx={100} cy={100} r={55} fill="none" stroke={RIM} strokeWidth={1.6} opacity={0.85} />
      ) : null}
      <Path
        d="M54 76 A52 52 0 0 1 76 52"
        fill="none"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <Circle cx={100} cy={100} r={64} fill="none" stroke={INK} strokeWidth={3} />
    </>
  );
}

function Orbit({ half }: { half: 'back' | 'front' }) {
  const d = half === 'back' ? 'M8 100 A92 24 0 0 1 192 100' : 'M192 100 A92 24 0 0 1 8 100';
  const back = half === 'back';
  return (
    <G opacity={back ? 0.45 : 1}>
      <Path d={d} fill="none" stroke={INDIGO} strokeWidth={3} strokeLinecap="round" />
      <Path
        d={d}
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="18 222"
        opacity={back ? 0.4 : 0.95}
      />
    </G>
  );
}

function Props({ list }: { list?: PennyStateMeta['props'] }) {
  if (!list?.length) return null;
  return (
    <G>
      {list.includes('dots')
        ? (
            [
              [160, 44, 3],
              [172, 31, 4.2],
              [186, 16, 5.6],
            ] as const
          ).map(([x, y, r]) => (
            <Circle key={`d-${x}`} cx={x} cy={y} r={r} fill={INDIGO} />
          ))
        : null}
      {list.includes('bubble') ? (
        <G transform="translate(166, 30)">
          <Path
            d="M-22 -13 H22 A12 12 0 0 1 22 11 H-6 L-14 19 L-13 11 H-22 A12 12 0 0 1 -22 -13Z"
            fill="#fff"
            stroke={INK}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {([-10, 0, 10] as const).map((x) => (
            <Circle key={x} cx={x} cy={-1} r={3.2} fill={INDIGO} />
          ))}
        </G>
      ) : null}
      {list.includes('spark1') ? (
        <G transform="translate(188, 52) scale(0.8)">
          <Path d={STAR} fill={GOLD} stroke={INK} strokeWidth={1.8} />
        </G>
      ) : null}
      {list.includes('sparks')
        ? (
            [
              [16, 38, 1],
              [188, 46, 0.8],
              [50, 6, 0.6],
              [158, 8, 0.7],
            ] as const
          ).map(([x, y, s], i) => (
            <G key={`sp-${i}`} transform={`translate(${x}, ${y}) scale(${s})`}>
              <Path d={STAR} fill={i % 2 ? '#fff' : GOLD} stroke={INK} strokeWidth={1.6} />
            </G>
          ))
        : null}
      {list.includes('check') ? (
        <G transform="translate(168, 34)">
          <Circle r={14} fill={INDIGO} stroke={INK} strokeWidth={2.6} />
          <Path
            d="M-6 0.5 L-1.8 4.8 L6.5 -4.8"
            fill="none"
            stroke="#fff"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      ) : null}
      {list.includes('badge') ? (
        <G transform="translate(168, 34)">
          <Circle r={14} fill={INDIGO} stroke={INK} strokeWidth={2.6} />
          <Path d="M0 -6 V1.5" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" />
          <Circle cy={6.2} r={2} fill="#fff" />
        </G>
      ) : null}
      {list.includes('zzz')
        ? (
            [
              [148, 40, 0.7],
              [162, 24, 0.9],
              [178, 6, 1.1],
            ] as const
          ).map(([x, y, s]) => (
            <G key={`z-${x}`} transform={`translate(${x}, ${y}) scale(${s})`}>
              <Path
                d="M-5 -6 H5 L-5 6 H5"
                fill="none"
                stroke={INDIGO}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          ))
        : null}
      {list.includes('hearts')
        ? (
            [
              [166, 40, 1],
              [32, 46, 0.8],
              [188, 78, 0.65],
            ] as const
          ).map(([x, y, s]) => (
            <G key={`h-${x}`} transform={`translate(${x}, ${y}) scale(${s})`}>
              <Path
                d="M0 7 C-13 -2 -8 -13 0 -6 C8 -13 13 -2 0 7Z"
                fill="#FF7A8A"
                stroke={INK}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
            </G>
          ))
        : null}
    </G>
  );
}

function CurrencySymbols({ list }: { list: string[] }) {
  const c = list[0] ?? '$';
  const fontSize = c.length > 1 ? 46 : 64;
  return (
    <SvgText
      x={100}
      y={102}
      textAnchor="middle"
      alignmentBaseline="central"
      fontWeight="800"
      fontSize={fontSize}
      fill="#E4AE2F"
      stroke={INK}
      strokeWidth={2.6}
    >
      {c}
    </SvgText>
  );
}

export function PennyFigureSvg({
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
  const uid = useId().replace(/:/g, '');
  const kit = toKitState(pose);
  const meta = PENNY_STATE_META[kit];
  const clipId = `pc-${uid}`;
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

  const viewBox = compact ? '0 20 200 180' : '-20 -10 240 230';

  return (
    <Animated.View
      style={[{ width: size, height: size }, motionStyle]}
      accessibilityLabel={title ?? `Penny, ${kit}`}
    >
      <Svg width={size} height={size} viewBox={viewBox}>
        <G>
          <Orbit half="back" />
          <G>
            <CoinBody clipId={clipId} compact={compact} />
            {symbols?.length ? (
              <CurrencySymbols list={symbols} />
            ) : (
              <>
                <Eyes kind={meta.eyes} />
                <Mouth kind={meta.mouth} />
              </>
            )}
          </G>
          <Orbit half="front" />
        </G>
        {!compact ? <Props list={meta.props} /> : null}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
void styles;
