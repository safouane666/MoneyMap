'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10 text-ink">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight">
        {t('brand')}
      </Link>
      <div className="w-full max-w-md animate-reveal rounded-[var(--cm-radius-feature)] border border-border bg-surface p-6 cm-shadow md:p-8">
        {children}
      </div>
    </div>
  );
}
