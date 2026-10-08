'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/i18n';
import { ApiError, apiFetch } from '@/lib/api';
import { loadSetupSession } from '@/lib/setup-session';
import { migrateGuestLedgerToSpace, snapshotGuestLedger } from '@/lib/guest-migrate';

function SignUpForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/app/home';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Keep guest ledger for transfer into the new account.
      const guest = snapshotGuestLedger();

      const result = await apiFetch<{ user?: { id: string } }>('/auth/sign-up/email', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
        timeoutMs: 25_000,
      });
      if (result.offline) {
        setError(t('auth.serverUnreachable'));
        return;
      }

      await apiFetch('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan: 'free' }),
        timeoutMs: 15_000,
      }).catch(() => null);

      const setup = loadSetupSession();
      const setupResult = await apiFetch<{ spaceId?: string }>('/me/setup-complete', {
        method: 'POST',
        body: JSON.stringify({
          locale: setup.language,
          defaultCurrency: setup.currency,
          notificationEnabled: setup.notificationsEnabled,
        }),
        timeoutMs: 15_000,
      });
      if (setupResult.offline) {
        setError(t('auth.serverUnreachable'));
        return;
      }

      const spaceId = setupResult.data?.spaceId;
      if (spaceId) {
        await migrateGuestLedgerToSpace(spaceId, guest);
      }

      router.push(next.startsWith('/') ? next : '/app/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.signUpTitle')}</h1>
      <div className="mt-6 space-y-3">
        <GoogleSignInButton next={next} />
        <p className="text-center text-xs text-ink-muted">{t('auth.orEmail')}</p>
      </div>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">{t('auth.name')}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" type="submit" disabled={loading}>
          {t('auth.submitSignUp')}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-secondary">
        {t('auth.hasAccount')}{' '}
        <Link
          href={`/auth/sign-in${next !== '/app/home' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-brand hover:underline"
        >
          {t('nav.signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
