'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getBillingConfig } from '@/lib/billing';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PlanUpgradeActions({
  onUpgraded,
  compact,
}: {
  onUpgraded?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const billing = getBillingConfig();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!billing.showPaymentUi) {
    return <p className="text-sm text-ink-secondary">{t('billing.betaNoCheckout')}</p>;
  }

  const upgrade = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ message?: string }>('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan: 'plus' }),
      });
      if (result.offline) {
        setMessage(t('account.needOnline'));
        return;
      }
      setMessage(result.data?.message || t('billing.upgraded'));
      await onUpgraded?.();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('billing.upgradeFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void upgrade()}>
          {busy ? t('billing.upgrading') : t('billing.upgrade')}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/app/account">{t('account.title')}</Link>
        </Button>
      </div>
      {message ? <p className="text-sm text-ink-secondary">{message}</p> : null}
    </div>
  );
}

export function PlanGate({
  title,
  body,
  onUpgraded,
}: {
  title: string;
  body: string;
  onUpgraded?: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const billing = getBillingConfig();

  return (
    <Alert variant="warning">
      <AlertDescription className="space-y-3">
        <div>
          <p className="font-medium text-ink">{title}</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {billing.showPaymentUi ? body : t('billing.betaLimitSoft')}
          </p>
        </div>
        {billing.showPaymentUi ? <PlanUpgradeActions onUpgraded={onUpgraded} compact /> : null}
      </AlertDescription>
    </Alert>
  );
}
