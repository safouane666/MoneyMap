'use client';

import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { getBillingConfig } from '@/lib/billing';

export default function PricingPage() {
  const { t } = useI18n();
  const billing = getBillingConfig();

  return (
    <MarketingShell>
      <div className="cm-content px-4 py-16 md:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">{t('pricing.title')}</h1>
        <p className="mt-3 max-w-xl text-lg text-ink-secondary">{t('pricing.subtitle')}</p>

        {!billing.showPaymentUi ? (
          <p className="mt-10 rounded-[var(--cm-radius-card)] border border-border bg-surface p-6 text-ink-secondary">
            {t('pricing.hidden')}
          </p>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {billing.plans
              .filter((p) => p.id === 'free' || p.id === 'plus')
              .map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-[var(--cm-radius-feature)] border border-border bg-surface p-6 cm-shadow"
                >
                  <h2 className="text-xl font-semibold">{plan.label}</h2>
                  <p className="mt-2 text-3xl font-semibold tabular">
                    {plan.monthlyPrice === 0 || plan.monthlyPrice === null
                      ? '$0'
                      : `$${plan.monthlyPrice}`}
                    <span className="text-base font-normal text-ink-muted"> / mo</span>
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-ink-secondary">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f}>{f.replace(/_/g, ' ')}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}

        <Button asChild className="mt-10">
          <Link href="/app/account">{t('pricing.cta')}</Link>
        </Button>
      </div>
    </MarketingShell>
  );
}
