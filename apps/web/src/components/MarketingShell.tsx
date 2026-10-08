'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Sora } from 'next/font/google';
import { useI18n } from '@/lib/i18n';
import { CONTACT_EMAIL } from '@/lib/contact';
import { Button } from '@/components/ui/button';

const sora = Sora({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-marketing',
  display: 'swap',
});

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className={`${sora.variable} min-h-dvh bg-canvas text-ink`} style={{ fontFamily: 'var(--font-marketing), var(--cm-font)' }}>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/75 backdrop-blur-md">
        <div className="cm-content flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5 tracking-tight">
            <Image
              src="/brand/penny-icon.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <span className="text-xl font-semibold text-ink">{t('brand')}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/#features">{t('nav.features')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reviews">{t('nav.reviews')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/pricing">{t('nav.pricing')}</Link>
            </Button>
          </nav>
          <div className="flex items-center gap-2">
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
      <footer className="border-t border-border bg-[color-mix(in_srgb,var(--cm-brand)_6%,var(--cm-canvas))] py-12">
        <div className="cm-content grid gap-8 px-4 md:grid-cols-[1.2fr_1fr_1fr] md:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/brand/penny-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
              <p className="text-lg font-semibold">{t('brand')}</p>
            </div>
            <p className="mt-3 max-w-sm text-sm text-ink-secondary">{t('tagline')}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-4 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-muted">{t('footer.product')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/#features" className="text-ink-secondary hover:text-ink">
                  {t('nav.features')}
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="text-ink-secondary hover:text-ink">
                  {t('nav.reviews')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-ink-secondary hover:text-ink">
                  {t('nav.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/setup/language" className="text-ink-secondary hover:text-ink">
                  {t('nav.signUp')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-muted">{t('footer.legal')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/legal" className="text-ink-secondary hover:text-ink">
                  {t('footer.legal')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-ink-secondary hover:text-ink">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-ink-secondary hover:text-ink">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-ink-secondary hover:text-ink">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-ink-muted">
          © {new Date().getFullYear()} Penny · {t('footer.rights')}
        </p>
      </footer>
    </div>
  );
}
