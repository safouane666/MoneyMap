'use client';

import Link from 'next/link';
import { SetupShell } from '@/components/SetupShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { markSetupStep, saveSetupSession } from '@/lib/setup-session';
import { nextSetupPath } from '@/lib/setup-steps';

export default function SetupMeetPage() {
  const { t } = useI18n();

  return (
    <SetupShell stepId="meet">
      <h1 className="text-3xl font-semibold tracking-tight">{t('setup.meetTitle')}</h1>
      <p className="mt-3 text-lg text-ink-secondary">{t('setup.meetBody')}</p>
      <Button asChild className="mt-10 w-full" size="lg">
        <Link
          href={nextSetupPath('meet')}
          onClick={() => {
            saveSetupSession({ companionSeen: true, welcomeSeen: true });
            markSetupStep('meet');
          }}
        >
          {t('setup.meetCta')}
        </Link>
      </Button>
    </SetupShell>
  );
}
