import { formatMinorUnits } from '@clear-money/domain';
import { useMemo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type SafeToSpendRingProps = {
  estimateMinor: number;
  maxMinor: number;
  currency: string;
  locale?: string;
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  fillColor: string;
  inkColor: string;
  mutedColor: string;
  subLabel?: string;
  style?: ViewStyle;
};

export function SafeToSpendRing({
  estimateMinor,
  maxMinor,
  currency,
  locale = 'en',
  size = 152,
  strokeWidth = 10,
  trackColor,
  fillColor,
  inkColor,
  mutedColor,
  subLabel,
  style,
}: SafeToSpendRingProps) {
  const ratio = useMemo(() => {
    if (maxMinor <= 0) return estimateMinor > 0 ? 1 : 0;
    return Math.min(1, Math.max(0, estimateMinor / maxMinor));
  }, [estimateMinor, maxMinor]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const center = formatMinorUnits(Math.max(0, estimateMinor), currency, locale);

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="image"
      accessibilityLabel={center}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ paddingHorizontal: 12, alignItems: 'center' }}>
        <Text
          style={{
            color: inkColor,
            fontSize: 20,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            textAlign: 'center',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {center}
        </Text>
        {subLabel ? (
          <Text
            style={{
              color: mutedColor,
              fontSize: 10,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginTop: 2,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {subLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
