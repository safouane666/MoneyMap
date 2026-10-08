'use client';

import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';

/** Email verification is not enabled (no transactional email yet). */
export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
      <p className="mt-3 text-ink-secondary">
        Email verification isn&apos;t required for this release. Continue to your ledger.
      </p>
      <Button asChild className="mt-8 w-full">
        <Link href="/app/home">Continue</Link>
      </Button>
    </AuthShell>
  );
}
