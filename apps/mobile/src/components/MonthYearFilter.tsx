import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

export type MonthYear = { year: number; month: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function currentMonthYear(): MonthYear {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function inMonthYear(iso: string, my: MonthYear): boolean {
  const d = new Date(iso);
  return d.getFullYear() === my.year && d.getMonth() === my.month;
}

export function MonthYearFilter({
  value,
  onChange,
}: {
  value: MonthYear;
  onChange: (next: MonthYear) => void;
}) {
  const colors = useThemeColors();
  const years = Array.from({ length: 6 }, (_, i) => currentMonthYear().year - i);

  return (
    <View style={styles.row}>
      <View style={styles.chips}>
        {MONTHS.map((name, idx) => {
          const on = value.month === idx;
          return (
            <Pressable
              key={name}
              onPress={() => onChange({ ...value, month: idx })}
              style={[
                styles.chip,
                {
                  borderColor: on ? colors.brand : colors.border,
                  backgroundColor: on ? colors.brandTint : colors.surface,
                },
              ]}
            >
              <Text style={{ color: on ? colors.brand : colors.inkSecondary, fontWeight: '600', fontSize: 13 }}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.chips}>
        {years.map((y) => {
          const on = value.year === y;
          return (
            <Pressable
              key={y}
              onPress={() => onChange({ ...value, year: y })}
              style={[
                styles.chip,
                {
                  borderColor: on ? colors.brand : colors.border,
                  backgroundColor: on ? colors.brandTint : colors.surface,
                },
              ]}
            >
              <Text style={{ color: on ? colors.brand : colors.inkSecondary, fontWeight: '600', fontSize: 13 }}>
                {y}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 40,
    paddingHorizontal: space[3],
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
