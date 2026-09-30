import {
  evaluateGoalPace,
  formatDate,
  formatMinorUnits,
  goalProgressRatio,
  goalRemaining,
  monthlyTargetMinor,
  type Goal,
  type GoalPaceStatus,
} from '@clear-money/domain';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../lib/i18n';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, shadow, space } from '../theme/tokens';

function paceColor(pace: GoalPaceStatus, colors: ReturnType<typeof useThemeColors>): string {
  switch (pace) {
    case 'ahead':
    case 'on_track':
      return colors.income;
    case 'tight':
      return colors.warning;
    case 'behind':
    case 'lost':
      return colors.expense;
    case 'won':
      return colors.brand;
    default:
      return colors.brand;
  }
}

function paceBg(pace: GoalPaceStatus, colors: ReturnType<typeof useThemeColors>): string {
  switch (pace) {
    case 'ahead':
    case 'on_track':
      return 'rgba(21,154,114,0.18)';
    case 'tight':
      return 'rgba(199,131,36,0.2)';
    case 'behind':
    case 'lost':
      return 'rgba(217,93,93,0.18)';
    case 'won':
      return colors.brandTint;
    default:
      return colors.brandTint;
  }
}

export function GoalCard({ goal, locale = 'en' }: { goal: Goal; locale?: string }) {
  const colors = useThemeColors();
  const ratio = Math.min(1, Math.max(0, goalProgressRatio(goal)));
  const remaining = goalRemaining(goal);
  const pace = evaluateGoalPace(goal, new Date().toISOString().slice(0, 10)).paceStatus;
  const monthly = monthlyTargetMinor(goal);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const endDate = goal.targetDate.slice(0, 10);
  const indicator = paceColor(pace, colors);

  return (
    <View
      style={[
        styles.card,
        shadow.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.top}>
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={2}>
          {goal.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: paceBg(pace, colors) }]}>
          <Text style={[styles.badgeText, { color: indicator }]}>
            {t(locale, `goals.pace.${pace}`)}
          </Text>
        </View>
      </View>
      <Text style={[styles.amount, { color: colors.ink }]}>
        {formatMinorUnits(goal.savedMinor, goal.currency, locale)}
        <Text style={[styles.amountMuted, { color: colors.inkMuted }]}>
          {' / '}
          {formatMinorUnits(goal.targetMinor, goal.currency, locale)}
        </Text>
      </Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(ratio * 100)}%`, backgroundColor: indicator },
          ]}
        />
      </View>
      <Text style={[styles.meta, { color: colors.inkSecondary }]}>
        {t(locale, 'goals.remaining')}: {formatMinorUnits(remaining, goal.currency, locale)}
      </Text>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.dt, { color: colors.inkMuted }]}>{t(locale, 'goals.monthlyTarget')}</Text>
          <Text style={[styles.dd, { color: colors.ink }]}>
            {formatMinorUnits(monthly, goal.currency, locale)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.dt, { color: colors.inkMuted }]}>{t(locale, 'goals.timeline')}</Text>
          <Text style={[styles.dd, { color: colors.inkSecondary, flex: 1, textAlign: 'right' }]}>
            → {formatDate(endDate, locale, tz)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  amount: {
    marginTop: space[3],
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  amountMuted: { fontSize: 16, fontWeight: '400' },
  track: {
    marginTop: space[4],
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 999 },
  meta: { marginTop: space[2], fontSize: 14 },
  footer: {
    marginTop: space[4],
    paddingTop: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space[4] },
  dt: { fontSize: 13 },
  dd: { fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
