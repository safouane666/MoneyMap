'use client';

import Link from 'next/link';
import { SHIPPED_LOCALES } from '@clear-money/domain';
import { SetupShell } from '@/components/SetupShell';
import { SetupLocaleCard } from '@/components/setup/SetupLocaleCard';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { markSetupStep, type SetupLanguage } from '@/lib/setup-session';
import { nextSetupPath } from '@/lib/setup-steps';

export default function SetupLanguagePage() {
  const { t, locale, setLocale } = useI18n();

  return (
    <SetupShell stepId="language">
      <h1 className="text-3xl font-semibold tracking-tight">{t('setup.languageTitle')}</h1>
      <p className="mt-2 text-ink-secondary">{t('setup.languageBody')}</p>
      <div className="mt-8 space-y-3">
        {SHIPPED_LOCALES.map((lang) => (
          <SetupLocaleCard
            key={lang.code}
            nativeName={lang.nativeName}
            englishName={lang.englishName}
            selected={locale === lang.code}
            onSelect={() => {
              setLocale(lang.code as SetupLanguage);
              markSetupStep('language');
            }}
          />
        ))}
      </div>
      <Button asChild className="mt-8 w-full" size="lg">
        <Link
          href={nextSetupPath('language')}
          onClick={() => markSetupStep('language')}
        >
          {t('setup.continue')}
        </Link>
      </Button>
    </SetupShell>
  );
}
