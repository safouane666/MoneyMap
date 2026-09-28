'use client';

import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';

export default function BillingCancelPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Checkout cancelled</h1>
      <p className="mt-3 text-ink-secondary">
        No changes were made. You can still try Plus locally from Account or Settings.
      </p>
      <Button asChild className="mt-6">
        <Link href="/app/account">Back to account</Link>
      </Button>
    </AuthShell>
  );
}
