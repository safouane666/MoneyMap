'use client';

import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';

export default function BillingSuccessPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">You’re set</h1>
      <p className="mt-3 text-ink-secondary">
        Local billing update completed. No card was charged in this demo build.
      </p>
      <Button asChild className="mt-6">
        <Link href="/app/account">Back to account</Link>
      </Button>
    </AuthShell>
  );
}
