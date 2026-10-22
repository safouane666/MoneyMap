import { evaluateAmountExpression } from '@clear-money/domain';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

export type AmountKeypadProps = {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  tone?: 'expense' | 'income';
  calculateLabel?: string;
};

type Key =
  | '1'
  | '2'
  | '3'
  | '+'
  | '4'
  | '5'
  | '6'
  | '−'
  | '7'
  | '8'
  | '9'
  | '×'
  | '.'
  | '0'
  | 'back'
  | '÷'
  | '=';

const KEYS: Key[] = [
  '1',
  '2',
  '3',
  '+',
  '4',
  '5',
  '6',
  '−',
  '7',
  '8',
  '9',
  '×',
  '.',
  '0',
  'back',
  '÷',
];

const OPS = new Set(['+', '−', '×', '÷']);

function lastNumberHasDot(expr: string): boolean {
  const m = expr.match(/[\d.]+$/);
  return Boolean(m?.[0]?.includes('.'));
}

function endsWithOperator(expr: string): boolean {
  return /[+\-−×÷*/x]$/i.test(expr.trim());
}

export function AmountKeypad({
  value,
  onChange,
  currency,
  tone = 'expense',
  calculateLabel = 'Calculate',
}: AmountKeypadProps) {
  const colors = useThemeColors();

  const pressDigit = (digit: string) => {
    if (digit === '.') {
      if (!value || endsWithOperator(value)) {
        onChange(`${value}0.`);
        return;
      }
      if (lastNumberHasDot(value)) return;
      onChange(`${value}.`);
      return;
    }
    const m = value.match(/([\d.]*)$/);
    const currentNum = m?.[1] ?? '';
    if (currentNum.includes('.')) {
      const frac = currentNum.split('.')[1] ?? '';
      if (frac.length >= 3) return;
    } else if ((currentNum.replace(/^0+/, '') || '').length >= 9) {
      return;
    }
    if (value === '0') {
      onChange(digit);
      return;
    }
    onChange(`${value}${digit}`);
  };

  const pressOp = (op: string) => {
    if (!value) return;
    if (endsWithOperator(value)) {
      onChange(`${value.slice(0, -1)}${op}`);
      return;
    }
    onChange(`${value}${op}`);
  };

  const pressEquals = () => {
    if (!value || endsWithOperator(value)) return;
    try {
      onChange(evaluateAmountExpression(value));
    } catch {
      // keep expression; save will surface the error
    }
  };

  const press = (key: Key) => {
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '=') {
      pressEquals();
      return;
    }
    if (OPS.has(key)) {
      pressOp(key);
      return;
    }
    pressDigit(key);
  };

  const display = value || '0';
  const showCalcHint = /[+\-−×÷*/x]/i.test(value);
  const amountColor = tone === 'income' ? colors.income : colors.expense;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={pressEquals}
        accessibilityRole="button"
        accessibilityLabel="Calculate amount"
        style={styles.displayTap}
      >
        <Text style={[styles.currency, { color: colors.inkMuted }]}>{currency}</Text>
        <Text
          style={[styles.display, { color: amountColor }]}
          accessibilityLiveRegion="polite"
        >
          {display}
        </Text>
        {showCalcHint ? (
          <Text style={[styles.hint, { color: colors.inkMuted }]}>
            Tap amount or = to calculate
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.grid}>
        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={styles.keyRow}>
            {KEYS.slice(row * 4, row * 4 + 4).map((key) => {
              const isOp = OPS.has(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => press(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key === 'back' ? 'Delete' : key}
                  style={({ pressed }) => [
                    styles.key,
                    {
                      backgroundColor: isOp ? colors.brandTint : colors.surface,
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  {key === 'back' ? (
                    <Ionicons name="backspace-outline" size={22} color={colors.ink} />
                  ) : (
                    <Text
                      style={[
                        styles.keyText,
                        {
                          color: isOp ? colors.brand : colors.ink,
                          fontWeight: isOp ? '700' : '500',
                        },
                      ]}
                    >
                      {key}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
        <Pressable
          onPress={() => press('=')}
          accessibilityRole="button"
          accessibilityLabel="Equals"
          style={({ pressed }) => [
            styles.calcRow,
            {
              backgroundColor: colors.brandTint,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <Text style={[styles.calcEquals, { color: colors.brand }]}>=</Text>
          <Text style={[styles.calcLabel, { color: colors.brand }]}>{calculateLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  displayTap: { alignItems: 'center', width: '100%' },
  currency: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  display: {
    marginTop: space[2],
    fontSize: 44,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  hint: { marginTop: space[1], fontSize: 12 },
  grid: {
    gap: space[2],
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  keyRow: { flexDirection: 'row', gap: space[2] },
  key: {
    flex: 1,
    height: 56,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 20 },
  calcRow: {
    width: '100%',
    flexBasis: '100%',
    height: 48,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  calcLabel: { fontSize: 14, fontWeight: '700' },
  calcEquals: { fontSize: 18, fontWeight: '700' },
});
