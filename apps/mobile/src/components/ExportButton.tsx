import { Alert, Pressable, Share, StyleSheet, Text } from 'react-native';
import { can, formatMinorUnits, type LedgerTransaction, type SpaceRole } from '@clear-money/domain';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

export function buildCsv(
  rows: LedgerTransaction[],
  locale: string,
): string {
  const header = 'id,type,amount,currency,description,occurredAt';
  const body = rows
    .map((r) =>
      [
        r.id,
        r.type,
        formatMinorUnits(r.amountMinor, r.currency, locale).replace(/,/g, ''),
        r.currency,
        JSON.stringify(r.description ?? ''),
        r.occurredAt,
      ].join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

export function ExportButton({
  transactions,
  fileSuffix,
  spaceName,
  role,
  locale = 'en',
}: {
  transactions: LedgerTransaction[];
  fileSuffix?: string;
  spaceName: string;
  role?: SpaceRole;
  locale?: string;
}) {
  const colors = useThemeColors();
  if (role && !can(role, 'export')) return null;

  const suffix = fileSuffix ? `-${fileSuffix}` : '';
  const filename = `${spaceName.toLowerCase().replace(/\s+/g, '-')}${suffix}-export.csv`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        const csv = buildCsv(transactions, locale);
        void Share.share({
          title: filename,
          message: csv,
        }).catch((err) => {
          Alert.alert(t(locale, 'app.export'), err instanceof Error ? err.message : 'Share failed');
        });
      }}
      style={[styles.btn, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.label, { color: colors.ink }]}>{t(locale, 'app.export')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '600' },
});
