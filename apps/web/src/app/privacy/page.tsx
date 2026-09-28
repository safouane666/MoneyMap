import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';

export const metadata: Metadata = {
  title: 'Privacy',
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="cm-content mx-auto max-w-2xl px-4 py-16 md:px-6">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Clear Money</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Privacy</h1>
        <p className="mt-4 text-ink-secondary">
          Clear Money stores the account and ledger data you create so the product can sync across
          your devices. We do not sell your transaction history for advertising.
        </p>
        <p className="mt-4 text-ink-secondary">
          This page is a placeholder for store / finance compliance. Replace it with approved legal
          copy before public launch (see production plan blocker B3).
        </p>
        <p className="mt-8">
          <Link href="/" className="text-brand underline-offset-4 hover:underline">
            Back home
          </Link>
        </p>
      </article>
    </MarketingShell>
  );
}
