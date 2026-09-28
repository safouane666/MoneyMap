'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SetupShell } from '@/components/SetupShell';
import { SetupFeatureCarousel } from '@/components/setup/SetupFeatureCarousel';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { markSetupStep } from '@/lib/setup-session';
import { nextSetupPath } from '@/lib/setup-steps';

export default function SetupFeaturesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [toured, setToured] = useState(false);

  return (
    <SetupShell stepId="features" pose={toured ? 'cheer' : 'think'}>
      <h1 className="text-3xl font-semibold tracking-tight">{t('setup.featuresTitle')}</h1>
      <p className="mt-2 text-ink-secondary">{t('setup.featuresBody')}</p>
      <div className="mt-6">
        <SetupFeatureCarousel onComplete={() => setToured(true)} />
      </div>
      <Button
        className="mt-8 w-full"
        size="lg"
        disabled={!toured}
        onClick={() => {
          markSetupStep('features');
          router.push(nextSetupPath('features'));
        }}
      >
        {t('setup.continue')}
      </Button>
    </SetupShell>
  );
}
