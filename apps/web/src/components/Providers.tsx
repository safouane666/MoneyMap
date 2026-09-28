'use client';

import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import { LedgerProvider } from '@/lib/ledger';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
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
