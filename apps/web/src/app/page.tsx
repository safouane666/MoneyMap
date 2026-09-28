'use client';

import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { getBillingConfig } from '@/lib/billing';

export default function LandingPage() {
  const { t } = useI18n();
  const billing = getBillingConfig();

  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 cm-aurora opacity-90" />
        <div className="cm-content relative grid items-center gap-12 px-4 pb-20 pt-16 md:grid-cols-2 md:px-6 md:pb-28 md:pt-24">
          <div className="animate-reveal">
            <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">{t('brand')}</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              {t('landing.promise')}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-ink-secondary">{t('landing.support')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/setup/language">{t('landing.ctaPrimary')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">{t('landing.ctaSecondary')}</Link>
              </Button>
            </div>
          </div>

          <div className="relative animate-reveal stagger-2 cm-float">
            <div className="rounded-[var(--cm-radius-feature)] border border-border bg-surface/90 p-5 cm-shadow backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-secondary">Personal · This month</p>
                <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand">
                  Live demo
                </span>
              </div>
              <p className="mt-6 text-sm text-ink-muted">Net result</p>
              <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">$3,842.90</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[var(--cm-radius-card)] bg-[color-mix(in_srgb,var(--cm-income)_10%,white)] p-4">
                  <p className="text-xs text-ink-secondary">Income</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-income">+$4,450.00</p>
                </div>
                <div className="rounded-[var(--cm-radius-card)] bg-[color-mix(in_srgb,var(--cm-expense)_10%,white)] p-4">
                  <p className="text-xs text-ink-secondary">Expenses</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-expense">−$607.10</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {[
                  { name: 'Groceries', amount: '−$48.60', tone: 'expense' },
                  { name: 'Freelance', amount: '+$250.00', tone: 'income' },
                  { name: 'Transit', amount: '−$18.50', tone: 'expense' },
                ].map((row) => (
                  <li key={row.name} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{row.name}</span>
                    <span
                      className={
                        row.tone === 'income' ? 'font-semibold tabular-nums text-income' : 'font-semibold tabular-nums text-expense'
                      }
                    >
                      {row.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="cm-content px-4 py-16 md:px-6">
        <h2 className="text-2xl font-semibold tracking-tight animate-reveal">{t('landing.useCasesTitle')}</h2>
        <p className="mt-2 max-w-xl text-ink-secondary">{t('tagline')}</p>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {(['personal', 'household', 'shared'] as const).map((key, i) => (
            <li
              key={key}
              className={`rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow stagger-${i + 1}`}
            >
              <p className="font-medium text-ink">{t(`landing.useCases.${key}`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="cm-content px-4 py-16 md:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t('landing.privacyTitle')}</h2>
          <p className="mt-3 max-w-2xl text-ink-secondary">{t('landing.privacyBody')}</p>
        </div>
      </section>

      <section className="cm-content px-4 py-16 md:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t('landing.pricingPreviewTitle')}</h2>
        <p className="mt-3 max-w-2xl text-ink-secondary">{t('landing.pricingPreviewBody')}</p>
        {billing.showPaymentUi ? (
          <div className="mt-8 flex gap-4">
            <div className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5">
              <p className="font-semibold">{t('pricing.free')}</p>
              <p className="mt-1 text-sm text-ink-secondary">$0</p>
            </div>
            <div className="rounded-[var(--cm-radius-card)] border border-brand bg-brand-tint p-5">
              <p className="font-semibold text-brand">{t('pricing.plus')}</p>
              <p className="mt-1 text-sm text-ink-secondary">From $4.99</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">{t('pricing.hidden')}</p>
        )}
        <Button asChild className="mt-8">
          <Link href="/setup/language">{t('landing.ctaPrimary')}</Link>
        </Button>
      </section>
    </MarketingShell>
  );
}
