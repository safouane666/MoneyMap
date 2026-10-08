'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/i18n';
import { ApiError, apiFetch, startGoogleSignIn } from '@/lib/api';
import { clearLocalSessionCaches } from '@/lib/session-cache';

function SignInForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/app/home';
  const autoGoogle = searchParams.get('google') === '1';
  const startedGoogle = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoGoogle || startedGoogle.current) return;
    if (typeof window === 'undefined') return;
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return;
    }
    startedGoogle.current = true;
    void startGoogleSignIn(next).catch((err) => {
      setError(err instanceof ApiError ? err.message : t('auth.googleFailed'));
    });
  }, [autoGoogle, next, t]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      clearLocalSessionCaches();
      const result = await apiFetch<{ user?: { id: string } }>('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        timeoutMs: 25_000,
      });
      if (result.offline) {
        setError(t('auth.serverUnreachable'));
        return;
      }
      router.push(next.startsWith('/') ? next : '/app/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
      <div className="mt-6 space-y-3">
        <GoogleSignInButton next={next} />
        <p className="text-center text-xs text-ink-muted">{t('auth.orEmail')}</p>
      </div>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
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
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" type="submit" disabled={loading}>
          {t('auth.submitSignIn')}
        </Button>
      </form>
      {searchParams.get('skip') === '1' ? (
        <p className="mt-4 text-center">
          <Link href="/app/home" className="text-sm font-medium text-brand hover:underline">
            {t('setup.skipAccount')}
          </Link>
        </p>
      ) : null}
      <p className="mt-4 text-center text-sm text-ink-secondary">
        {t('auth.noAccount')}{' '}
        <Link
          href={`/auth/sign-up${next !== '/app/home' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-brand hover:underline"
        >
          {t('nav.signUp')}
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
