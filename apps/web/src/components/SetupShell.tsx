'use client';

import Link from 'next/link';
import { SetupCompanion } from '@/components/setup/SetupCompanion';
import { useI18n } from '@/lib/i18n';
import { SETUP_STEP_META, type SetupPose, type SetupStepId } from '@/lib/setup-steps';

export function SetupShell({
  children,
  stepId,
  pose: poseOverride,
  bubbleKey: bubbleOverride,
}: {
  children: React.ReactNode;
  stepId: SetupStepId;
  pose?: SetupPose;
  bubbleKey?: string;
}) {
  const { t } = useI18n();
  const meta = SETUP_STEP_META[stepId];
  const pose = poseOverride ?? meta.pose;
  const bubble = t(bubbleOverride ?? meta.bubbleKey);
  const total = 6;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <div className="pointer-events-none absolute inset-0 cm-aurora opacity-80" />

      <header className="relative z-10 px-4 pt-5 md:px-6">
        <div className="cm-content flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {t('brand')}
          </Link>
          <span className="text-sm tabular-nums text-ink-muted">
            {meta.step}/{total}
          </span>
        </div>
        <div className="cm-content mt-4 flex gap-1.5" role="progressbar" aria-valuenow={meta.step} aria-valuemin={1} aria-valuemax={total}>
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-[var(--cm-motion-medium)] ${
                i < meta.step ? 'bg-brand' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:items-start md:justify-center md:gap-10 md:px-6 md:py-10">
        <aside className="w-full shrink-0 md:sticky md:top-8 md:w-56 lg:w-64">
          <SetupCompanion pose={pose} bubble={bubble} name={t('setup.companionName')} />
        </aside>
        <div className="w-full max-w-lg flex-1 animate-reveal pb-8">{children}</div>
      </main>
    </div>
  );
}
