'use client';

import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function VerifyEmailPage() {
  const { t } = useI18n();
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.verifyTitle')}</h1>
      <p className="mt-3 text-ink-secondary">{t('auth.verifyBody')}</p>
      <Button asChild className="mt-8 w-full">
        <Link href="/app/home">{t('setup.continue')}</Link>
      </Button>
    </AuthShell>
  );
}
