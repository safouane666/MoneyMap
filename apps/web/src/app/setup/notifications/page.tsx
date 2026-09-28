'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SetupShell } from '@/components/SetupShell';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { loadSetupSession, markSetupStep, saveSetupSession } from '@/lib/setup-session';
import { nextSetupPath } from '@/lib/setup-steps';

export default function SetupNotificationsPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(loadSetupSession().notificationsEnabled);
  }, []);

  const choose = (value: boolean) => {
    setEnabled(value);
    saveSetupSession({ notificationsEnabled: value });
    markSetupStep('notifications');
  };

  return (
    <SetupShell stepId="notifications">
      <h1 className="text-3xl font-semibold tracking-tight">{t('setup.notificationsTitle')}</h1>
      <p className="mt-3 text-ink-secondary">{t('setup.notificationsBody')}</p>
      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={() => choose(true)}
          className={`min-h-16 rounded-[var(--cm-radius-feature)] border px-5 py-4 text-start transition-colors ${
            enabled
              ? 'border-brand bg-brand-tint text-brand'
              : 'border-border bg-surface text-ink hover:bg-canvas'
          }`}
        >
          <p className="font-semibold">{t('setup.enable')}</p>
          <p className={`mt-1 text-sm ${enabled ? 'text-brand/80' : 'text-ink-muted'}`}>
            {t('setup.notificationsBenefit')}
          </p>
        </button>
        <button
          type="button"
          onClick={() => choose(false)}
          className={`min-h-14 rounded-[var(--cm-radius-feature)] border px-5 py-4 text-start transition-colors ${
            !enabled
              ? 'border-brand bg-brand-tint text-brand'
              : 'border-border bg-surface text-ink hover:bg-canvas'
          }`}
        >
          <p className="font-semibold">{t('setup.disable')}</p>
        </button>
      </div>
      <Button asChild className="mt-8 w-full" size="lg">
        <Link
          href={nextSetupPath('notifications')}
          onClick={() => markSetupStep('notifications')}
        >
          {t('setup.continue')}
        </Link>
      </Button>
    </SetupShell>
  );
}
