import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

export type Period = 'thisWeek' | 'thisMonth' | 'lastMonth';

/** Compact dropdown matching web PeriodSelector (h-11 / ~176px trigger). */
export function PeriodSelector({
  value,
  onChange,
  locale = 'en',
}: {
  value: Period;
  onChange: (value: Period) => void;
  locale?: string;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const options: { value: Period; label: string }[] = [
    { value: 'thisWeek', label: t(locale, 'home.thisWeek') },
    { value: 'thisMonth', label: t(locale, 'home.thisMonth') },
    { value: 'lastMonth', label: t(locale, 'home.lastMonth') },
  ];
  const current = options.find((o) => o.value === value)?.label ?? t(locale, 'home.thisMonth');

  return (
    <View style={styles.wrap}>
      <Text style={[styles.caption, { color: colors.inkSecondary }]}>
        {t(locale, 'home.period')}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
        accessibilityRole="button"
      >
        <Text style={[styles.triggerLabel, { color: colors.ink }]} numberOfLines={1}>
          {current}
        </Text>
        <Text style={{ color: colors.inkMuted, fontSize: 12 }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={[styles.option, active && { backgroundColor: colors.brandTint }]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: active ? colors.brand : colors.ink },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Match web: label + select in one row so "Period" never ellipsizes.
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
    flexGrow: 0,
  },
  caption: {
    fontSize: 14,
    flexShrink: 0,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    width: 176,
    minWidth: 176,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
  },
  triggerLabel: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: space[6],
  },
  sheet: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    minHeight: 44,
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },
});
