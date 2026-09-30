import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { formatMinorUnits } from '@clear-money/domain';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, shadow, space } from '../theme/tokens';

export function SummaryCard({
  label,
  amountMinor,
  currency,
  locale = 'en',
  tone = 'net',
  large,
}: {
  label: string;
  amountMinor: number;
  currency: string;
  locale?: string;
  tone?: 'net' | 'income' | 'expense';
  large?: boolean;
}) {
  const colors = useThemeColors();
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.stopAnimation();
    anim.setValue(0);
    const listener = anim.addListener(({ value }) => {
      setDisplay(Math.round(value));
    });
    Animated.timing(anim, {
      toValue: amountMinor,
      duration: 420,
      useNativeDriver: false,
    }).start();
    return () => {
      anim.removeListener(listener);
    };
  }, [amountMinor, anim]);

  return (
    <View
      style={[
        styles.card,
        large && styles.cardLarge,
        shadow.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.inkSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          large && styles.valueLarge,
          { color: colors.ink },
          tone === 'income' && { color: colors.income },
          tone === 'expense' && { color: colors.expense },
        ]}
      >
        {formatMinorUnits(display, currency, locale)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
  },
  cardLarge: {
    padding: 28,
  },
  label: {
    fontSize: 14,
  },
  value: {
    marginTop: space[2],
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  valueLarge: {
    fontSize: 36,
    letterSpacing: -0.6,
  },
});
