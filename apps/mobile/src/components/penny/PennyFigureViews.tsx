import { StyleSheet, Text, View } from 'react-native';
import { toKitState, type PennyPose } from './penny-states';

const INK = '#1A1F36';
const GOLD = '#F7D060';
const INDIGO = '#5B5CE2';
const SHADE = '#E9BC42';
const RIM = '#D9A62E';

/**
 * Expo Go stand-in: same palette / orbit / face poses as web Penny.
 * No reanimated / svg — those crash New Arch Expo Go ("property is not writable").
 */
export function PennyFigureViews({
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
  const wink = kit === 'hello';
  const happy = kit === 'goal' || kit === 'thanks' || kit === 'saved';
  const think = kit === 'think';
  const alert = kit === 'alert';
  const showSymbol = kit === 'roll';
  const closed = kit === 'sleep';

  const coin = size * (compact ? 0.78 : 0.7);
  const eyeW = coin * 0.08;
  const eyeH = coin * 0.14;

  return (
    <View
      style={[{ width: size, height: size }, styles.wrap]}
      accessibilityLabel={title ?? `Penny, ${kit}`}
    >
      <View
        style={[
          styles.orbit,
          {
            width: size * 0.92,
            height: size * 0.26,
            borderRadius: size,
            borderColor: INDIGO,
          },
        ]}
      />

      <View
        style={[
          styles.coinOuter,
          {
            width: coin,
            height: coin,
            borderRadius: coin / 2,
            backgroundColor: SHADE,
          },
        ]}
      >
        <View
          style={[
            styles.coinInner,
            {
              width: coin * 0.92,
              height: coin * 0.92,
              borderRadius: coin * 0.46,
              backgroundColor: GOLD,
              borderColor: INK,
            },
          ]}
        >
          {!compact ? (
            <View
              style={[
                styles.rim,
                {
                  width: coin * 0.78,
                  height: coin * 0.78,
                  borderRadius: coin * 0.39,
                  borderColor: RIM,
                },
              ]}
            />
          ) : null}
          <View
            style={[
              styles.glint,
              {
                width: coin * 0.28,
                height: coin * 0.12,
                borderRadius: coin,
                top: coin * 0.14,
                left: coin * 0.14,
              },
            ]}
          />

          {showSymbol ? (
            <Text style={[styles.symbol, { fontSize: coin * 0.4 }]}>$</Text>
          ) : (
            <>
              <View style={[styles.eyes, { gap: coin * 0.12, marginTop: coin * 0.06 }]}>
                <View
                  style={{
                    width: eyeW,
                    height: wink || happy || closed ? Math.max(2, eyeW * 0.28) : eyeH,
                    borderRadius: 99,
                    backgroundColor: INK,
                    marginTop: wink || happy ? eyeH * 0.3 : think ? -eyeH * 0.18 : 0,
                  }}
                />
                <View
                  style={{
                    width: eyeW,
                    height: happy || closed ? Math.max(2, eyeW * 0.28) : eyeH,
                    borderRadius: 99,
                    backgroundColor: INK,
                    marginTop: happy ? eyeH * 0.3 : think ? -eyeH * 0.18 : 0,
                  }}
                />
              </View>
              {alert ? (
                <View style={[styles.brows, { width: coin * 0.34 }]}>
                  <View style={[styles.brow, { transform: [{ rotate: '-16deg' }] }]} />
                  <View style={[styles.brow, { transform: [{ rotate: '16deg' }] }]} />
                </View>
              ) : null}
              <View
                style={[
                  styles.mouth,
                  {
                    width: coin * (happy ? 0.26 : 0.2),
                    height: coin * (happy ? 0.11 : 0.07),
                    borderColor: INK,
                    borderBottomLeftRadius: coin,
                    borderBottomRightRadius: coin,
                    marginTop: coin * 0.04,
                  },
                ]}
              />
            </>
          )}
        </View>
      </View>

      {!compact && (kit === 'hello' || kit === 'goal') ? (
        <View style={[styles.spark, { right: size * 0.04, top: size * 0.1 }]}>
          <Text style={{ fontSize: size * 0.13, color: GOLD }}>✦</Text>
        </View>
      ) : null}
      {!compact && kit === 'think' ? (
        <View style={[styles.dots, { right: size * 0.02, top: size * 0.06 }]}>
          <View style={[styles.dot, { width: 4, height: 4, opacity: 0.5 }]} />
          <View style={[styles.dot, { width: 6, height: 6, opacity: 0.75 }]} />
          <View style={[styles.dot, { width: 8, height: 8 }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  orbit: {
    position: 'absolute',
    borderWidth: 2.5,
    opacity: 0.55,
  },
  coinOuter: { alignItems: 'center', justifyContent: 'center' },
  coinInner: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rim: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.85,
  },
  glint: {
    position: 'absolute',
    backgroundColor: '#fff',
    opacity: 0.45,
    transform: [{ rotate: '-35deg' }],
  },
  eyes: { flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  brows: {
    position: 'absolute',
    top: '30%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  brow: { width: 11, height: 2.5, borderRadius: 2, backgroundColor: INK },
  mouth: { borderWidth: 2.5, borderTopWidth: 0, zIndex: 1 },
  symbol: {
    fontWeight: '800',
    color: '#E4AE2F',
    zIndex: 1,
  },
  spark: { position: 'absolute' },
  dots: { position: 'absolute', alignItems: 'center', gap: 4 },
  dot: { borderRadius: 99, backgroundColor: INDIGO },
});
