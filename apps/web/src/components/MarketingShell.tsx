'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-border/80 bg-surface/80 backdrop-blur">
        <div className="cm-content flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {t('brand')}
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/pricing">{t('nav.pricing')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/sign-in">{t('nav.signIn')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/setup/language">{t('nav.signUp')}</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border py-8 text-center text-sm text-ink-muted">
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} Clear Money</p>
      </footer>
    </div>
  );
}
