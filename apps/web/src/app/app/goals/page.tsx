'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  computeSafeToSpend,
  formatMinorUnits,
  monthlyTargetMinor,
  parseDisplayAmount,
  type CurrencyCode,
  type Goal,
} from '@clear-money/domain';
import { GoalCard } from '@/components/GoalCard';
import { PlanGate } from '@/components/PlanGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace, getSpaceTotals, sumActiveRecurringExpensesMinor } from '@/lib/demo-state';
import { ApiError } from '@/lib/api';

export default function GoalsPage() {
  const { t, locale } = useI18n();
  const {
    state,
    createGoal,
    updateGoal,
    evaluateGoal,
    deleteGoal,
    signedIn,
    sessionUser,
    offline,
  } = useLedger();
  const space = getActiveSpace(state);
  const goals = state.goals.filter((g) => g.spaceId === space.id && g.status === 'active');
  const totals = getSpaceTotals(state, space.id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [durationMonths, setDurationMonths] = useState('3');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [progressFor, setProgressFor] = useState<Goal | null>(null);
  const [progressAmount, setProgressAmount] = useState('');

  const monthlyPreview = useMemo(() => {
    const targetMinor = Math.abs(parseDisplayAmount(target || '0', space.currency as CurrencyCode));
    const months = Math.floor(Number(durationMonths));
    if (targetMinor <= 0 || !Number.isFinite(months) || months < 1) return null;
    return monthlyTargetMinor({
      targetMinor,
      durationMonths: months,
      plannedContributionMinor: 0,
    });
  }, [durationMonths, space.currency, target]);

  const safe = useMemo(
    () =>
      computeSafeToSpend({
        incomeMinor: totals.incomeMinor,
        expenseMinor: totals.expenseMinor,
        plannedContributionMinor: goals.reduce(
          (s, g) => s + (g.plannedContributionMinor > 0 ? g.plannedContributionMinor : monthlyTargetMinor(g)),
          0,
        ),
        scheduledExpenseMinor: sumActiveRecurringExpensesMinor(state, space.id),
        bufferMinor: 0,
        currency: space.currency,
        hasRequiredInputs: totals.incomeMinor > 0 || state.transactions.length > 0,
      }),
    [goals, space.currency, space.id, state, totals],
  );

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLocked(false);
    try {
      const targetMinor = Math.abs(
        parseDisplayAmount(target, space.currency as CurrencyCode),
      );
      if (targetMinor <= 0) throw new ApiError(t('goals.invalidTarget'), 400);
      const months = Math.floor(Number(durationMonths));
      if (!Number.isFinite(months) || months < 1) {
        throw new ApiError(t('goals.invalidDuration'), 400);
      }
      await createGoal({
        name,
        targetMinor,
        currency: space.currency,
        durationMonths: months,
        startDate: startDate.trim() || undefined,
      });
      setName('');
      setTarget('');
      setDurationMonths('3');
      setStartDate(new Date().toISOString().slice(0, 10));
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('goals.createFailed');
      if (err instanceof ApiError && err.status === 402) setLocked(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onProgress = async (e: FormEvent) => {
    e.preventDefault();
    if (!progressFor) return;
    setLoading(true);
    setError(null);
    try {
      const add = Math.abs(parseDisplayAmount(progressAmount, space.currency as CurrencyCode));
      await updateGoal(progressFor.id, { savedMinor: progressFor.savedMinor + add });
      await evaluateGoal(progressFor.id).catch(() => null);
      setProgressFor(null);
      setProgressAmount('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('goals.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.goals')}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" disabled={!signedIn || offline}>
              {t('goals.create')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('goals.createTitle')}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={onCreate}>
              <div className="space-y-2">
                <Label htmlFor="goal-name">{t('goals.name')}</Label>
                <Input
                  id="goal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-target">{t('goals.target')}</Label>
                <Input
                  id="goal-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-duration">{t('goals.durationLabel')}</Label>
                <Input
                  id="goal-duration"
                  type="number"
                  min={1}
                  step={1}
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  required
                />
                {monthlyPreview != null ? (
                  <p className="text-xs text-ink-muted">
                    {t('goals.monthlyTarget')}:{' '}
                    {formatMinorUnits(monthlyPreview, space.currency, locale)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-start">{t('goals.startDate')}</Label>
                <Input
                  id="goal-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-xs text-ink-muted">{t('goals.startDateHint')}</p>
              </div>
              {locked ? (
                <PlanGate title={t('goals.lockedTitle')} body={t('goals.lockedBody')} />
              ) : null}
              {error && !locked ? <p className="text-sm text-expense">{error}</p> : null}
              <DialogFooter>
                <Button type="submit" disabled={loading || !name.trim() || !target.trim()}>
                  {loading ? t('goals.creating') : t('goals.create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!signedIn ? (
        <p className="text-sm text-ink-secondary">{t('goals.needLogin')}</p>
      ) : null}

      {sessionUser?.plan === 'free' ? (
        <p className="text-xs text-ink-muted">{t('goals.freeCap')}</p>
      ) : null}

      <p className="text-sm text-ink-secondary">{t('goals.savedManualNote')}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('goals.safeToSpend')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {safe.status === 'insufficient' ? (
            <p className="text-sm text-ink-secondary">{t('goals.insufficient')}</p>
          ) : (
            <>
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {formatMinorUnits(safe.estimateMinor ?? 0, safe.currency, locale)}
              </p>
              <p className="text-sm text-ink-secondary">{safe.message}</p>
              <ul className="space-y-1 text-sm text-ink-secondary">
                {safe.breakdown.map((row) => (
                  <li key={row.label} className="flex justify-between gap-4">
                    <span>{row.label}</span>
                    <span className="tabular-nums">
                      {formatMinorUnits(row.amountMinor, safe.currency, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.length === 0 ? (
          <p className="text-sm text-ink-secondary">{t('goals.empty')}</p>
        ) : (
          goals.map((goal) => (
            <div key={goal.id} className="space-y-2">
              <GoalCard goal={goal} locale={locale} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProgressFor(goal);
                    setProgressAmount('');
                    setError(null);
                  }}
                >
                  {t('goals.addProgress')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void deleteGoal(goal.id)}
                >
                  {t('app.delete')}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={Boolean(progressFor)} onOpenChange={(v) => !v && setProgressFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('goals.addProgress')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onProgress}>
            <div className="space-y-2">
              <Label htmlFor="goal-progress">{t('goals.progressAmount')}</Label>
              <Input
                id="goal-progress"
                value={progressAmount}
                onChange={(e) => setProgressAmount(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-expense">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={loading || !progressAmount.trim()}>
                {t('txn.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
