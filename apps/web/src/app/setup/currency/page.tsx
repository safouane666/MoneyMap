'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CURRENCY_CATALOG } from '@clear-money/domain';
import { SetupShell } from '@/components/SetupShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { loadSetupSession, markSetupStep, saveSetupSession } from '@/lib/setup-session';
import { nextSetupPath } from '@/lib/setup-steps';

export default function SetupCurrencyPage() {
  const { t } = useI18n();
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setCurrency(loadSetupSession().currency);
  }, []);

  const filtered = CURRENCY_CATALOG.filter(
    (c) =>
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase()),
  ).slice(0, 12);

  return (
    <SetupShell stepId="currency">
      <h1 className="text-3xl font-semibold tracking-tight">{t('setup.currencyTitle')}</h1>
      <p className="mt-2 text-ink-secondary">{t('setup.currencyBody')}</p>
      <Input
        className="mt-6"
        placeholder={t('setup.currencySearch')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => {
              setCurrency(c.code);
              saveSetupSession({ currency: c.code });
              markSetupStep('currency');
            }}
            className={`flex h-12 w-full items-center justify-between rounded-[var(--cm-radius-control)] border px-4 text-sm ${
              currency === c.code
                ? 'border-brand bg-brand-tint text-brand'
                : 'border-border bg-surface'
            }`}
          >
            <span>
              {c.code} · {c.name}
            </span>
            <span className="text-ink-muted">{c.symbol}</span>
          </button>
        ))}
      </div>
      <Button asChild className="mt-8 w-full" size="lg">
        <Link
          href={nextSetupPath('currency')}
          onClick={() => markSetupStep('currency')}
        >
          {t('setup.continue')}
        </Link>
      </Button>
    </SetupShell>
  );
}
