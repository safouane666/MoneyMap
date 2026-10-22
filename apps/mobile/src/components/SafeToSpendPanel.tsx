import { formatMinorUnits, type SafeToSpendResult } from '@clear-money/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeToSpendRing } from './SafeToSpendRing';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, shadow, space } from '../theme/tokens';

export function SafeToSpendPanel({
  safe,
  incomeMinor,
  locale,
}: {
  safe: SafeToSpendResult;
  incomeMinor: number;
  locale: string;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  if (safe.status === 'insufficient') {
    return (
      <View
        style={[
          styles.card,
          shadow.card,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'goals.safeToSpendShort')}</Text>
        <Text style={{ color: colors.inkSecondary, fontSize: 14, marginTop: space[2] }}>
          {t(locale, 'goals.insufficient')}
        </Text>
      </View>
    );
  }

  const estimate = safe.estimateMinor ?? 0;
  const maxMinor = incomeMinor > 0 ? incomeMinor : Math.max(estimate, 1);

  return (
    <View
      style={[
        styles.card,
        shadow.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.hero}>
        <SafeToSpendRing
          estimateMinor={estimate}
          maxMinor={maxMinor}
          currency={safe.currency}
          locale={locale}
          trackColor={colors.border}
          fillColor={colors.brand}
          inkColor={colors.ink}
          mutedColor={colors.inkMuted}
          subLabel={t(locale, 'goals.safeToSpendShort')}
        />
        <View style={styles.captionBlock}>
          <Text style={[styles.eyebrow, { color: colors.inkMuted }]}>
            {t(locale, 'goals.safeToSpendShort')}
          </Text>
          <Text style={{ color: colors.inkSecondary, fontSize: 13, lineHeight: 18 }}>
            {t(locale, 'goals.safeCaption')}
          </Text>
        </View>
      </View>

      {safe.breakdown?.length ? (
        <View style={[styles.details, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={styles.detailsToggle}
          >
            <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 14 }}>
              {open ? t(locale, 'goals.hideDetails') : t(locale, 'goals.detailsToggle')}
            </Text>
          </Pressable>
          {open
            ? safe.breakdown.map((row) => (
                <View key={row.label} style={styles.breakRow}>
                  <Text style={{ color: colors.inkSecondary, fontSize: 13, flex: 1 }}>{row.label}</Text>
                  <Text style={{ color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                    {formatMinorUnits(row.amountMinor, safe.currency, locale)}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
  },
  title: { fontSize: 16, fontWeight: '600' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  captionBlock: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: space[1],
  },
  details: {
    marginTop: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
  detailsToggle: { paddingVertical: space[1] },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space[4] },
});
