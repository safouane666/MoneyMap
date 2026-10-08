'use client';

import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL } from '@/lib/contact';
import { useI18n } from '@/lib/i18n';

const REVIEW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const;

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5 text-brand" aria-label={`${count} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < count ? 'opacity-100' : 'opacity-25'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { t } = useI18n();
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Penny app review')}`;

  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 cm-ad-hero opacity-70" />
        <div className="cm-content relative px-4 py-16 md:px-6 md:py-20">
          <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">{t('brand')}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {t('reviews.title')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-secondary">{t('reviews.subtitle')}</p>

          <div className="mt-10 flex flex-wrap items-end gap-8">
            <div>
              <p className="text-5xl font-semibold tabular-nums tracking-tight text-ink">4.8</p>
              <Stars count={5} />
              <p className="mt-1 text-sm text-ink-muted">{t('reviews.aggregate')}</p>
            </div>
            <Button asChild size="lg">
              <a href={mailto}>{t('reviews.writeCta')}</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="cm-content px-4 py-16 md:px-6">
        <ul className="grid gap-10 md:grid-cols-2">
          {REVIEW_KEYS.map((key) => {
            const stars = Number(t(`reviews.items.${key}.stars`)) || 5;
            return (
              <li key={key} className="border-t border-border pt-6">
                <div className="flex items-center justify-between gap-3">
                  <Stars count={stars} />
                  <p className="text-xs text-ink-muted">{t(`reviews.items.${key}.meta`)}</p>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-ink">{t(`reviews.items.${key}.title`)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {t(`reviews.items.${key}.body`)}
                </p>
                <p className="mt-3 text-sm font-medium text-ink">{t(`reviews.items.${key}.author`)}</p>
              </li>
            );
          })}
        </ul>

        <div className="mt-16 rounded-[var(--cm-radius-feature)] bg-brand-tint px-6 py-8 text-center md:px-10">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{t('reviews.inviteTitle')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-ink-secondary">{t('reviews.inviteBody')}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href={mailto}>{t('reviews.writeCta')}</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/setup/language">{t('landing.ctaPrimary')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
