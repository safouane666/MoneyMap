import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

export type CategoryFilterOption = { id: string; name: string };

export function CategoryFilter({
  options,
  value,
  onChange,
  locale = 'en',
}: {
  options: CategoryFilterOption[];
  value: string | 'all';
  onChange: (value: string | 'all') => void;
  locale?: string;
}) {
  const colors = useThemeColors();
  const chip = (id: string | 'all', label: string) => {
    const active = value === id;
    return (
      <Pressable
        key={id}
        onPress={() => onChange(id)}
        style={[
          styles.chip,
          {
            borderColor: active ? colors.brand : colors.border,
            backgroundColor: active ? colors.brandTint : colors.surface,
          },
        ]}
      >
        <Text
          style={{
            color: active ? colors.brand : colors.inkSecondary,
            fontSize: 12,
            fontWeight: '600',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chip('all', t(locale, 'reports.allCategories'))}
      {options.map((o) => chip(o.id, o.name))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], paddingVertical: 2 },
  chip: {
    height: 32,
    maxWidth: 140,
    paddingHorizontal: space[3],
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
