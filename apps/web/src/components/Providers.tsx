'use client';

import { useEffect } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import { LedgerProvider } from '@/lib/ledger';
import { ToastProvider } from '@/components/Toast';
import { initSentry } from '@/lib/sentry';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <LedgerProvider>{children}</LedgerProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
