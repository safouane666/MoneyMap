'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { apiFetch } from '@/lib/api';
import { clearLocalSessionCaches } from '@/lib/session-cache';
import { getBillingConfig } from '@/lib/billing';
import { PlanUpgradeActions } from '@/components/PlanGate';

export default function AccountPage() {
  const { t } = useI18n();
  const { offline, sessionUser, refresh } = useLedger();
  const billing = getBillingConfig();
  const [signingOut, setSigningOut] = useState(false);
  const [aiUsage, setAiUsage] = useState<{
    used: number;
    limit: number;
    remaining: number;
    plan: string;
  } | null>(null);

  const loadUsage = useCallback(async () => {
    if (offline || !sessionUser) {
      setAiUsage(null);
      return;
    }
    try {
      const result = await apiFetch<{
        used: number;
        limit: number;
        remaining: number;
        plan: string;
      }>('/ai/usage');
      if (!result.offline && result.data) setAiUsage(result.data);
    } catch {
      setAiUsage(null);
    }
  }, [offline, sessionUser]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch('/auth/sign-out', { method: 'POST', body: '{}' });
    } catch {
      /* still leave */
    }
    clearLocalSessionCaches();
    window.location.href = '/auth/sign-in';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('account.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('account.status')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionUser ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t('account.signedIn')}</Badge>
                <span className="text-sm text-ink-secondary capitalize">
                  {sessionUser.plan ?? 'free'}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{sessionUser.name || sessionUser.email}</p>
                <p className="text-ink-secondary">{sessionUser.email}</p>
              </div>
              {aiUsage ? (
                <p className="text-sm text-ink-secondary">
                  {t('account.pennyCredits', {
                    remaining: aiUsage.remaining,
                    limit: aiUsage.limit,
                  })}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={signingOut} onClick={() => void signOut()}>
                  {signingOut ? t('settings.signingOut') : t('settings.signOut')}
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/app/settings">{t('nav.settings')}</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert variant="warning">
                <AlertDescription>{t('account.demoBody')}</AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/auth/sign-in?next=${encodeURIComponent('/app/account')}`}>
                    {t('nav.signIn')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/auth/sign-up?next=${encodeURIComponent('/app/account')}`}>
                    {t('nav.signUp')}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {sessionUser ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.billing')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink-secondary">
              {billing.showPaymentUi ? t('billing.localNote') : t('billing.betaNoCheckout')}
            </p>
            {billing.showPaymentUi ? (
              <PlanUpgradeActions
                onUpgraded={async () => {
                  await refresh();
                  await loadUsage();
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
