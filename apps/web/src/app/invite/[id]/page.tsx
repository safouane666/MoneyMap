'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError, apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';

type InviteInfo = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
  space: { id: string; name: string } | null;
};

type Me = { id: string; email?: string } | null;

export default function InviteAcceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const { refresh, setSpace } = useLedger();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inviteResult = await apiFetch<InviteInfo>(`/invitations/${id}`);
      if (inviteResult.offline || !inviteResult.data) {
        setError(t('spaces.inviteNotFound'));
        setInvite(null);
        setMe(null);
        return;
      }
      setInvite(inviteResult.data);

      try {
        const meResult = await apiFetch<Me>('/me');
        setMe(meResult.offline ? null : meResult.data);
      } catch {
        setMe(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('spaces.inviteNotFound'));
      setInvite(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const result = await apiFetch<{ ok: boolean; spaceId: string }>(
        `/invitations/${id}/accept`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      if (result.offline || !result.data) {
        setError(t('spaces.needOnline'));
        return;
      }
      await refresh();
      setSpace(result.data.spaceId);
      router.push(`/app/spaces/${result.data.spaceId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('spaces.acceptFailed'));
    } finally {
      setAccepting(false);
    }
  };

  const nextPath = `/invite/${id}`;
  const signedIn = Boolean(me?.id);

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('spaces.acceptTitle')}</h1>
      {loading ? (
        <p className="mt-4 text-sm text-ink-secondary">{t('spaces.loadingInvite')}</p>
      ) : null}

      {!loading && invite ? (
        <div className="mt-6 space-y-4">
          <p className="text-ink-secondary">
            {t('spaces.acceptBody', {
              space: invite.space?.name ?? t('spaces.title'),
              email: invite.email,
              role: invite.role,
            })}
          </p>
          {invite.status !== 'pending' ? (
            <Alert variant="warning">
              <AlertDescription>{t('spaces.inviteNotPending')}</AlertDescription>
            </Alert>
          ) : null}
          {error ? <p className="text-sm text-expense">{error}</p> : null}

          {signedIn ? (
            <Button
              className="w-full"
              onClick={onAccept}
              disabled={accepting || invite.status !== 'pending'}
            >
              {accepting ? t('spaces.accepting') : t('spaces.accept')}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-secondary">{t('spaces.signInToAccept')}</p>
              <Button asChild className="w-full">
                <Link href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}>
                  {t('nav.signIn')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}>
                  {t('nav.signUp')}
                </Link>
              </Button>
              <p className="text-center text-xs text-ink-muted">
                {t('spaces.useInviteEmail', { email: invite.email })}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {!loading && !invite ? (
        <Alert variant="warning" className="mt-6">
          <AlertDescription>{error ?? t('spaces.inviteNotFound')}</AlertDescription>
        </Alert>
      ) : null}
    </AuthShell>
  );
}
