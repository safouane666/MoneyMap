'use client';

import { useCallback, useEffect, useState } from 'react';
import { SHIPPED_LOCALES, CURRENCY_CATALOG } from '@clear-money/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { getBillingConfig } from '@/lib/billing';
import { apiFetch, ApiError } from '@/lib/api';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace } from '@/lib/demo-state';
import { loadSetupSession, saveSetupSession, type SetupLanguage } from '@/lib/setup-session';
import { clearLocalSessionCaches } from '@/lib/session-cache';

type SubState = {
  plan: string;
  subscription: { id: string; plan: string; status: string } | null;
  canManageLocally?: boolean;
};

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { state, updateSpace, signedIn } = useLedger();
  const { showToast } = useToast();
  const billing = getBillingConfig();
  const space = getActiveSpace(state);
  const [currency, setCurrency] = useState(space.currency || loadSetupSession().currency);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [sub, setSub] = useState<SubState | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [subOffline, setSubOffline] = useState(false);
  const [subUnauthorized, setSubUnauthorized] = useState(false);

  useEffect(() => {
    if (space.currency) setCurrency(space.currency);
  }, [space.currency, space.id]);

  const refreshSubscription = useCallback(async () => {
    try {
      const result = await apiFetch<SubState>('/billing/subscription');
      if (result.offline) {
        setSubOffline(true);
        setSubUnauthorized(false);
        setSub(null);
        return;
      }
      setSubOffline(false);
      setSubUnauthorized(false);
      setSub(result.data);
    } catch (err) {
      setSubOffline(true);
      setSubUnauthorized(err instanceof ApiError && err.status === 401);
      setSub(null);
    }
  }, []);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const saveCurrency = async (next: string) => {
    const code = next.trim().toUpperCase();
    if (!code || code === space.currency) {
      setCurrency(code || space.currency);
      return;
    }
    setCurrency(code);
    setCurrencyBusy(true);
    try {
      if (!space.id) throw new ApiError('No active space', 400);
      await updateSpace(space.id, { currency: code });
      saveSetupSession({ currency: code });
      showToast({ message: t('settings.currencySaved') });
    } catch (err) {
      setCurrency(space.currency);
      showToast({
        message: err instanceof ApiError ? err.message : t('settings.currencyFailed'),
      });
    } finally {
      setCurrencyBusy(false);
    }
  };

  const runBilling = async (path: string, body?: Record<string, unknown>) => {
    setSubBusy(true);
    setSubMessage(null);
    try {
      const result = await apiFetch<{ message?: string; plan?: string }>(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (result.offline) {
        setSubMessage('API offline — start the API on port 3011.');
        return;
      }
      setSubMessage(result.data?.message || 'Updated');
      await refreshSubscription();
    } catch (err) {
      setSubMessage(err instanceof ApiError ? err.message : 'Billing action failed');
    } finally {
      setSubBusy(false);
    }
  };

  const exportAccountData = async () => {
    setPrivacyBusy(true);
    try {
      const result = await apiFetch<{
        profile: unknown;
        memberships: unknown;
        exportedAt: string;
      }>('/account/export');
      if (result.offline) {
        showToast({ message: t('billing.apiOffline') });
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clear-money-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({ message: t('settings.exportDone') });
    } catch (err) {
      showToast({
        message: err instanceof ApiError ? err.message : t('settings.exportFailed'),
      });
    } finally {
      setPrivacyBusy(false);
    }
  };

  const deleteAccount = async () => {
    setPrivacyBusy(true);
    try {
      const result = await apiFetch<{ ok: boolean }>('/account/delete', {
        method: 'POST',
        body: '{}',
      });
      if (result.offline) {
        showToast({ message: t('billing.apiOffline') });
        return;
      }
      try {
        await apiFetch('/auth/sign-out', { method: 'POST', body: '{}' });
      } catch {
        /* session may already be invalid */
      }
      clearLocalSessionCaches();
      window.location.href = '/auth/sign-in';
    } catch (err) {
      showToast({
        message: err instanceof ApiError ? err.message : t('settings.deleteFailed'),
      });
      setPrivacyBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('nav.settings')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Label htmlFor="dark">{theme === 'dark' ? 'Dark' : 'Light'}</Label>
          <Switch
            id="dark"
            checked={theme === 'dark'}
            onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lang">{t('setup.languageTitle')}</Label>
            <select
              id="lang"
              className="flex h-11 w-full rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 text-sm"
              value={locale}
              onChange={(e) => {
                const next = e.target.value as SetupLanguage;
                setLocale(next);
                saveSetupSession({ language: next });
              }}
            >
              {SHIPPED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur">{t('settings.currency')}</Label>
            <select
              id="cur"
              className="flex h-11 w-full rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 text-sm"
              value={currency}
              disabled={currencyBusy || !space.id}
              onChange={(e) => {
                void saveCurrency(e.target.value);
              }}
            >
              {CURRENCY_CATALOG.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">
              {t('settings.currencyHint')}
              {space.name ? ` · ${space.name}` : ''}
              {!signedIn ? ' · demo' : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.notifications')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-secondary">
          <p>Device-local reminders. Manage quiet hours and preview mode on each device.</p>
          <p>Default lock-screen preview hides amounts.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.billing')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-ink-muted">
            {billing.showPaymentUi ? t('billing.localNote') : t('billing.betaNoCheckout')}
          </p>
          {subOffline ? (
            <Alert variant="info">
              <AlertDescription>
                {subUnauthorized ? t('billing.needSignIn') : t('billing.apiOffline')}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm">
                <p>
                  <span className="text-ink-muted">{t('billing.currentPlan')}: </span>
                  <strong className="capitalize">{sub?.plan ?? billing.defaultPlan}</strong>
                </p>
                <p className="mt-1 text-ink-secondary">
                  {sub?.subscription
                    ? `${t('billing.status')}: ${sub.subscription.status} · ${sub.subscription.plan}`
                    : t('billing.noSubscription')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {billing.showPaymentUi ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={subBusy}
                      onClick={() => void runBilling('/billing/subscribe', { plan: 'free' })}
                    >
                      {t('billing.startFree')}
                    </Button>
                    <Button
                      type="button"
                      disabled={subBusy}
                      onClick={() => void runBilling('/billing/subscribe', { plan: 'plus' })}
                    >
                      {t('billing.upgrade')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={subBusy || !sub?.subscription}
                      onClick={() => void runBilling('/billing/cancel')}
                    >
                      {t('billing.cancel')}
                    </Button>
                  </>
                ) : null}
              </div>
              {subMessage ? <p className="text-sm text-ink-secondary">{subMessage}</p> : null}
            </>
          )}
          {!billing.showPaymentUi ? (
            <Alert variant="info">
              <AlertDescription>{t('billing.betaNoCheckout')}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await apiFetch('/auth/sign-out', { method: 'POST', body: '{}' });
              } catch {
                /* still leave local session */
              }
              clearLocalSessionCaches();
              window.location.href = '/auth/sign-in';
            }}
          >
            {signingOut ? t('settings.signingOut') : t('settings.signOut')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.privacy')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={privacyBusy}
            onClick={() => void exportAccountData()}
          >
            {t('settings.exportData')}
          </Button>
          <Button
            variant="destructive"
            disabled={privacyBusy}
            onClick={() => setConfirmDelete(true)}
          >
            {t('settings.deleteAccount')}
          </Button>
        </CardContent>
      </Card>

      {confirmDelete ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            This permanently deletes your account. Shared Space records stay for other members.
            <Button
              size="sm"
              variant="destructive"
              disabled={privacyBusy}
              onClick={() => void deleteAccount()}
            >
              Confirm delete
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={privacyBusy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
