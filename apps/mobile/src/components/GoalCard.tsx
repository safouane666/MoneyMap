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
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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

function GoalProgressRing({
  ratio,
  strokeColor,
  trackColor,
  inkColor,
  mutedColor,
  pctLabel,
  savedLabel,
  targetLabel,
}: {
  ratio: number;
  strokeColor: string;
  trackColor: string;
  inkColor: string;
  mutedColor: string;
  pctLabel: string;
  savedLabel: string;
  targetLabel: string;
}) {
  const size = 112;
  const strokeWidth = 8;
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const clamped = Math.min(1, Math.max(0, ratio));
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ alignItems: 'center', paddingHorizontal: 6, maxWidth: size - 12 }}>
        <Text style={{ color: inkColor, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {pctLabel}
        </Text>
        <Text
          style={{ color: mutedColor, fontSize: 9, fontVariant: ['tabular-nums'], marginTop: 2 }}
          numberOfLines={1}
        >
          {savedLabel}
        </Text>
        <Text style={{ color: mutedColor, fontSize: 9, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
          / {targetLabel}
        </Text>
      </View>
    </View>
  );
}

export function GoalCard({ goal, locale = 'en' }: { goal: Goal; locale?: string }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const ratio = goalProgressRatio(goal);
  const remaining = goalRemaining(goal);
  const paceEval = evaluateGoalPace(goal, new Date().toISOString().slice(0, 10));
  const pace = paceEval.paceStatus;
  const monthly = monthlyTargetMinor(goal);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const endDate = goal.targetDate.slice(0, 10);
  const indicator = paceColor(pace, colors);
  const pctLabel = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;

  const savedLabel = useMemo(
    () => formatMinorUnits(goal.savedMinor, goal.currency, locale),
    [goal.currency, goal.savedMinor, locale],
  );
  const targetLabel = useMemo(
    () => formatMinorUnits(goal.targetMinor, goal.currency, locale),
    [goal.currency, goal.targetMinor, locale],
  );

  return (
    <View
      style={[
        styles.card,
        shadow.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.hero}>
        <GoalProgressRing
          ratio={ratio}
          strokeColor={indicator}
          trackColor={colors.border}
          inkColor={colors.ink}
          mutedColor={colors.inkMuted}
          pctLabel={pctLabel}
          savedLabel={savedLabel}
          targetLabel={targetLabel}
        />
        <View style={styles.meta}>
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
          <Text style={[styles.remaining, { color: colors.inkSecondary }]}>
            {t(locale, 'goals.remaining')}{' '}
            <Text style={{ color: colors.ink, fontWeight: '600' }}>
              {formatMinorUnits(remaining, goal.currency, locale)}
            </Text>
          </Text>
        </View>
      </View>

      <View style={[styles.details, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.detailsToggle}
        >
          <Text style={{ color: colors.inkMuted, fontWeight: '600', fontSize: 13 }}>
            {open ? t(locale, 'goals.hideDetails') : t(locale, 'goals.detailsToggle')}
          </Text>
        </Pressable>
        {open ? (
          <View style={{ gap: space[2] }}>
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
        ) : null}
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  meta: { flex: 1, minWidth: 0 },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[2],
  },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  remaining: { marginTop: space[2], fontSize: 14 },
  details: {
    marginTop: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailsToggle: { paddingVertical: space[1] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space[4] },
  dt: { fontSize: 13 },
  dd: { fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
