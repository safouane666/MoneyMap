'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

const FEATURE_KEYS = [
  'safeSpend',
  'spaces',
  'categories',
  'recurring',
  'pennyAi',
  'reminders',
  'languages',
  'privacy',
] as const;

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <MarketingShell>
      {/* Hero — one composition, brand-first, full-bleed atmosphere */}
      <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 cm-ad-hero" />
        <div className="pointer-events-none absolute inset-0 cm-ad-grain" />

        <div className="cm-content relative grid min-h-[calc(100dvh-4rem)] items-center gap-10 px-4 py-14 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:px-6 md:py-0">
          <div className="animate-reveal">
            <p className="text-[clamp(3.25rem,9vw,5.75rem)] font-semibold leading-[0.95] tracking-tight text-ink">
              {t('brand')}
            </p>
            <h1 className="mt-5 max-w-xl text-2xl font-medium leading-snug tracking-tight text-ink md:text-3xl">
              {t('landing.promise')}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-secondary md:text-lg">
              {t('landing.support')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="cm-ad-cta">
                <Link href="/setup/language">{t('landing.ctaPrimary')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/reviews">{t('landing.ctaSecondary')}</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[340px] animate-reveal stagger-2 md:max-w-[380px]">
            <div className="cm-phone-frame cm-float">
              <div className="cm-phone-notch" />
              <div className="cm-phone-screen">
                <div className="flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center gap-2">
                    <Image src="/brand/penny-icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
                    <div>
                      <p className="text-[11px] font-medium text-ink-muted">Personal</p>
                      <p className="text-sm font-semibold text-ink">{t('landing.demo.month')}</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {t('landing.demo.live')}
                  </span>
                </div>

                <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  {t('landing.demo.net')}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-ink">$3,842.90</p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[color-mix(in_srgb,var(--cm-income)_12%,white)] px-3 py-2.5">
                    <p className="text-[10px] text-ink-secondary">{t('landing.demo.income')}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-income">+$4,450</p>
                  </div>
                  <div className="rounded-xl bg-[color-mix(in_srgb,var(--cm-expense)_12%,white)] px-3 py-2.5">
                    <p className="text-[10px] text-ink-secondary">{t('landing.demo.expenses')}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-expense">−$607</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border/80 bg-brand-tint/70 px-3 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-brand">
                    {t('landing.demo.safe')}
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">$2,180</p>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {[
                    { name: t('landing.demo.row1'), amount: '−$48.60', tone: 'expense' as const },
                    { name: t('landing.demo.row2'), amount: '+$250.00', tone: 'income' as const },
                    { name: t('landing.demo.row3'), amount: '−$18.50', tone: 'expense' as const },
                  ].map((row) => (
                    <li key={row.name} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{row.name}</span>
                      <span
                        className={
                          row.tone === 'income'
                            ? 'font-semibold tabular-nums text-income'
                            : 'font-semibold tabular-nums text-expense'
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
        </div>
      </section>

      {/* What's new / features */}
      <section id="features" className="relative border-t border-border/70 bg-surface">
        <div className="cm-content px-4 py-20 md:px-6">
          <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">{t('landing.whatsNewEyebrow')}</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {t('landing.whatsNewTitle')}
          </h2>
          <p className="mt-3 max-w-xl text-ink-secondary">{t('landing.whatsNewBody')}</p>

          <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_KEYS.map((key, i) => (
              <li key={key} className={`animate-reveal stagger-${(i % 4) + 1}`}>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{t(`landing.features.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {t(`landing.features.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Use cases — one job */}
      <section className="border-t border-border/70">
        <div className="cm-content px-4 py-20 md:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{t('landing.useCasesTitle')}</h2>
          <p className="mt-3 max-w-xl text-ink-secondary">{t('landing.useCasesBody')}</p>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {(['personal', 'household', 'shared'] as const).map((key) => (
              <li key={key} className="border-l-2 border-brand pl-5">
                <p className="text-lg font-semibold text-ink">{t(`landing.useCases.${key}.title`)}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {t(`landing.useCases.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-t border-border/70 bg-[color-mix(in_srgb,var(--cm-brand)_8%,var(--cm-canvas))]">
        <div className="cm-content flex flex-col items-start justify-between gap-6 px-4 py-16 md:flex-row md:items-center md:px-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">{t('landing.reviewsEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
              {t('landing.reviewsTitle')}
            </h2>
            <p className="mt-2 max-w-lg text-ink-secondary">{t('landing.reviewsBody')}</p>
          </div>
          <Button asChild size="lg" variant="outline">
            <Link href="/reviews">{t('landing.reviewsCta')}</Link>
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border/70">
        <div className="pointer-events-none absolute inset-0 cm-ad-cta-band" />
        <div className="cm-content relative px-4 py-20 text-center md:px-6">
          <Image
            src="/brand/penny-icon.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto h-[72px] w-[72px] rounded-2xl shadow-soft"
          />
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{t('landing.finalTitle')}</h2>
          <p className="mx-auto mt-3 max-w-md text-ink-secondary">{t('landing.finalBody')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/setup/language">{t('landing.ctaPrimary')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">{t('landing.ctaPricing')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
