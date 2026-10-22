import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  computeSafeToSpend,
  computePeriodTotals,
  formatMinorUnits,
  monthlyTargetMinor,
  parseDisplayAmount,
  type CurrencyCode,
  type Goal,
} from '@clear-money/domain';
import { GoalCard } from '../../src/components/GoalCard';
import { SafeToSpendPanel } from '../../src/components/SafeToSpendPanel';
import { KeyboardAvoidingWrap } from '../../src/components/KeyboardAvoidingWrap';
import { t } from '../../src/lib/i18n';
import {
  createGoal,
  deleteGoal,
  evaluateGoal,
  goalsForSpace,
  loadLedger,
  recurringForSpace,
  transactionsForSpace,
  updateGoal,
  type MobileLedger,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, space } from '../../src/theme/tokens';

export default function GoalsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [months, setMonths] = useState('3');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressFor, setProgressFor] = useState<Goal | null>(null);
  const [progressAmount, setProgressAmount] = useState('');

  const refresh = useCallback(async () => {
    setLocale((await loadSetupSession()).language);
    setLedger(await loadLedger());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch((err) => {
        setError(err instanceof Error ? err.message : t('en', 'errors.generic'));
      });
    }, [refresh]),
  );

  const activeSpace = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
  const currency = activeSpace?.currency ?? 'USD';
  const goals = ledger ? goalsForSpace(ledger).filter((g) => g.status === 'active') : [];
  const guest = !ledger || ledger.userId === 'guest';
  const txns = ledger ? transactionsForSpace(ledger) : [];
  const totals = computePeriodTotals(txns, currency);
  const recurring = ledger ? recurringForSpace(ledger) : [];

  const monthlyPreview = useMemo(() => {
    try {
      const targetMinor = Math.abs(parseDisplayAmount(target || '0', currency as CurrencyCode));
      const duration = Math.floor(Number(months));
      if (targetMinor <= 0 || !Number.isFinite(duration) || duration < 1) return null;
      return monthlyTargetMinor({
        targetMinor,
        durationMonths: duration,
        plannedContributionMinor: 0,
      });
    } catch {
      return null;
    }
  }, [currency, months, target]);

  const safe = useMemo(
    () =>
      computeSafeToSpend({
        incomeMinor: totals.incomeMinor,
        expenseMinor: totals.expenseMinor,
        plannedContributionMinor: goals.reduce(
          (s, g) => s + (g.plannedContributionMinor > 0 ? g.plannedContributionMinor : monthlyTargetMinor(g)),
          0,
        ),
        scheduledExpenseMinor: recurring
          .filter((r) => r.kind === 'expense')
          .reduce((sum, r) => sum + r.amountMinor, 0),
        bufferMinor: 0,
        currency,
        hasRequiredInputs: totals.incomeMinor > 0 || txns.length > 0,
      }),
    [currency, goals, recurring, totals.expenseMinor, totals.incomeMinor, txns.length],
  );

  async function onCreate() {
    if (!ledger?.activeSpaceId || guest) return;
    setBusy(true);
    setError(null);
    try {
      const targetMinor = Math.abs(parseDisplayAmount(target, currency as CurrencyCode));
      if (targetMinor <= 0) throw new Error(t(locale, 'goals.invalidTarget'));
      const durationMonths = Math.floor(Number(months));
      if (!Number.isFinite(durationMonths) || durationMonths < 1) {
        throw new Error(t(locale, 'goals.invalidDuration'));
      }
      await createGoal({
        spaceId: ledger.activeSpaceId,
        name,
        targetMinor,
        currency,
        durationMonths,
        startDate: startDate.trim() || undefined,
      });
      setName('');
      setTarget('');
      setMonths('3');
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(locale, 'goals.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function onProgress() {
    if (!progressFor || !ledger?.activeSpaceId) return;
    setBusy(true);
    setError(null);
    try {
      const add = Math.abs(parseDisplayAmount(progressAmount, currency as CurrencyCode));
      await updateGoal(ledger.activeSpaceId, progressFor.id, {
        savedMinor: progressFor.savedMinor + add,
      });
      await evaluateGoal(ledger.activeSpaceId, progressFor.id);
      setProgressFor(null);
      setProgressAmount('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(locale, 'goals.updateFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'nav.goals')}</Text>
          <Pressable
            disabled={guest || ledger?.offline}
            onPress={() => setOpen(true)}
            style={[
              styles.cta,
              { backgroundColor: colors.brand, opacity: guest || ledger?.offline ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.ctaText}>{t(locale, 'goals.create')}</Text>
          </Pressable>
        </View>

        {guest ? (
          <Text style={{ color: colors.inkSecondary, fontSize: 14 }}>{t(locale, 'goals.needLogin')}</Text>
        ) : null}
        {ledger?.plan === 'free' ? (
          <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{t(locale, 'goals.freeCap')}</Text>
        ) : null}
        <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{t(locale, 'goals.savedManualNote')}</Text>
        {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}

        <SafeToSpendPanel safe={safe} incomeMinor={totals.incomeMinor} locale={locale} />

        {goals.length === 0 ? (
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
              {t(locale, 'goals.empty')}
            </Text>
            <Text
              style={{
                color: colors.inkSecondary,
                fontSize: 14,
                textAlign: 'center',
                marginTop: space[2],
                lineHeight: 20,
              }}
            >
              {t(locale, 'goals.emptyHint')}
            </Text>
          </View>
        ) : (
          goals.map((goal) => (
            <View key={goal.id} style={{ gap: space[2] }}>
              <GoalCard goal={goal} locale={locale} />
              <View style={styles.actions}>
                <Pressable
                  onPress={() => {
                    setProgressFor(goal);
                    setProgressAmount('');
                    setError(null);
                  }}
                  style={[styles.outline, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13 }}>
                    {t(locale, 'goals.addProgress')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!ledger?.activeSpaceId) return;
                    void deleteGoal(ledger.activeSpaceId, goal.id).then(refresh);
                  }}
                >
                  <Text style={{ color: colors.expense, fontWeight: '600', fontSize: 13 }}>
                    {t(locale, 'app.delete')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
        {guest ? (
          <Pressable onPress={() => router.push('/auth/sign-in')}>
            <Text style={{ color: colors.brand, fontWeight: '700' }}>{t(locale, 'nav.signIn')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingWrap style={styles.backdrop} keyboardVerticalOffset={24}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t(locale, 'goals.createTitle')}</Text>
            <TextInput
              placeholder={t(locale, 'goals.name')}
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
            />
            <TextInput
              placeholder={t(locale, 'goals.target')}
              keyboardType="decimal-pad"
              value={target}
              onChangeText={setTarget}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
            />
            <TextInput
              placeholder={t(locale, 'goals.durationLabel')}
              keyboardType="number-pad"
              value={months}
              onChangeText={setMonths}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
            />
            {monthlyPreview != null ? (
              <Text style={{ color: colors.inkMuted, fontSize: 12 }}>
                {t(locale, 'goals.monthlyTarget')}: {formatMinorUnits(monthlyPreview, currency, locale)}
              </Text>
            ) : null}
            <TextInput
              placeholder={t(locale, 'goals.startDate')}
              value={startDate}
              onChangeText={setStartDate}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
            />
            {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
            <Pressable
              disabled={busy || !name.trim() || !target.trim()}
              onPress={() => void onCreate()}
              style={[styles.cta, { backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={styles.ctaText}>{busy ? t(locale, 'goals.creating') : t(locale, 'goals.create')}</Text>
            </Pressable>
          </Pressable>
        </View>
        </KeyboardAvoidingWrap>
      </Modal>

      <Modal visible={Boolean(progressFor)} transparent animationType="fade" onRequestClose={() => setProgressFor(null)}>
        <KeyboardAvoidingWrap style={styles.backdrop} keyboardVerticalOffset={24}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setProgressFor(null)} />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t(locale, 'goals.addProgress')}</Text>
            <TextInput
              placeholder={t(locale, 'goals.progressAmount')}
              keyboardType="decimal-pad"
              value={progressAmount}
              onChangeText={setProgressAmount}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
            />
            {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
            <Pressable
              disabled={busy || !progressAmount.trim()}
              onPress={() => void onProgress()}
              style={[styles.cta, { backgroundColor: colors.brand }]}
            >
              <Text style={styles.ctaText}>{t(locale, 'txn.save')}</Text>
            </Pressable>
          </Pressable>
        </View>
        </KeyboardAvoidingWrap>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: 180, gap: space[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, flex: 1 },
  cta: { minHeight: 40, borderRadius: radius.control, paddingHorizontal: space[3], justifyContent: 'center', alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: space[8],
    paddingHorizontal: space[6],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], alignItems: 'center' },
  outline: { minHeight: 36, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space[3], justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCenter: { flex: 1, justifyContent: 'center', padding: space[6] },
  sheet: { borderRadius: radius.card, padding: space[5], gap: space[3] },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
  },
});
