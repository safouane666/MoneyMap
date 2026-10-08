'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  clearGuestSnapshot,
  migrateGuestLedgerToSpace,
  readGuestSnapshot,
} from '@/lib/guest-migrate';
import { getSetupResumePath, loadSetupSession } from '@/lib/setup-session';
import { SETUP_STEPS } from '@/lib/setup-steps';
import { clearLocalSessionCaches } from '@/lib/session-cache';

const MOBILE_SHELL_KEY = 'cm.mobileShell';

function setupComplete(): boolean {
  const { completedSteps } = loadSetupSession();
  return SETUP_STEPS.every((step) => completedSteps.includes(step));
}

/**
 * After Google (or any OAuth): migrate guest data only when the account ledger is empty.
 * Existing accounts with data keep their cloud ledger; guest local data is dropped.
 */
async function maybeMigrateGuestAfterAuth(): Promise<void> {
  const guest = readGuestSnapshot();
  if (!guest?.transactions?.length) {
    clearGuestSnapshot();
    return;
  }

  const spaces = await apiFetch<Array<{ id: string; type?: string }>>('/spaces', {
    timeoutMs: 12_000,
  });
  if (spaces.offline || !spaces.data?.length) {
    clearGuestSnapshot();
    return;
  }

  const personal =
    spaces.data.find((s) => s.type === 'personal') ?? spaces.data[0]!;
  const txns = await apiFetch<unknown[]>(`/spaces/${personal.id}/transactions`, {
    timeoutMs: 12_000,
  });
  if (txns.offline) {
    clearGuestSnapshot();
    return;
  }

  if ((txns.data?.length ?? 0) > 0) {
    // Existing account with data — discard guest.
    clearGuestSnapshot();
    clearLocalSessionCaches();
    return;
  }

  await migrateGuestLedgerToSpace(personal.id, guest);
}

/**
 * Mobile / in-app entry — never the marketing landing page.
 * Loading → setup (first run) → sign-in or skip → /app/home
 * Signed-in users go straight to home (with optional guest→account migrate).
 */
export default function AppBootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.setItem(MOBILE_SHELL_KEY, '1');
    } catch {
      /* ignore */
    }

    let cancelled = false;
    void (async () => {
      const me = await apiFetch<{ id?: string }>('/me', { timeoutMs: 12_000 });
      if (cancelled) return;

      if (!me.offline && me.data?.id) {
        await maybeMigrateGuestAfterAuth();
        if (cancelled) return;
        router.replace('/app/home');
        return;
      }

      if (!setupComplete()) {
        router.replace(getSetupResumePath());
        return;
      }

      router.replace('/auth/sign-in?skip=1&next=/app/home');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
}
