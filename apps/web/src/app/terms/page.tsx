import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';

export const metadata: Metadata = {
  title: 'Terms',
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="cm-content mx-auto max-w-2xl px-4 py-16 md:px-6">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Clear Money</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Terms of use</h1>
        <p className="mt-4 text-ink-secondary">
          Clear Money is provided as-is for personal and household money tracking. You are
          responsible for the accuracy of entries you create and for keeping your sign-in credentials
          private.
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
