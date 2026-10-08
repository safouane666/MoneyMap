'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SetupShell } from '@/components/SetupShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { markSetupStep } from '@/lib/setup-session';

const CONFETTI = [
  { left: '12%', delay: '0ms', color: 'var(--cm-brand)' },
  { left: '28%', delay: '80ms', color: 'var(--cm-income)' },
  { left: '44%', delay: '40ms', color: 'var(--cm-ai)' },
  { left: '60%', delay: '120ms', color: 'var(--cm-info)' },
  { left: '76%', delay: '60ms', color: 'var(--cm-warning)' },
  { left: '88%', delay: '100ms', color: 'var(--cm-brand)' },
];

export default function SetupReadyPage() {
  const { t } = useI18n();
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    markSetupStep('ready');
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShowCta(true);
      return;
    }
    const id = window.setTimeout(() => setShowCta(true), 700);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <SetupShell stepId="ready">
      <div className="relative overflow-hidden rounded-[var(--cm-radius-feature)] border border-border bg-surface/80 p-6 cm-shadow md:p-8">
        <div className="cm-confetti" aria-hidden>
          {CONFETTI.map((c) => (
            <span
              key={c.left}
              style={{
                left: c.left,
                background: c.color,
                animationDelay: c.delay,
              }}
            />
          ))}
        </div>
        <div className="cm-celebrate relative">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            {t('setup.celebrationEyebrow')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('setup.readyTitle')}</h1>
          <p className="mt-3 text-ink-secondary">{t('setup.readyBody')}</p>
        </div>
        <div
          className={`mt-8 flex flex-col gap-3 transition-opacity duration-[var(--cm-motion-medium)] ${
            showCta ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Button asChild size="lg">
            <Link href="/auth/sign-up">{t('nav.signUp')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/sign-in?skip=1&next=/app/home">{t('nav.signIn')}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/app/home">{t('setup.skipAccount')}</Link>
          </Button>
        </div>
      </div>
    </SetupShell>
  );
}
