import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { DeleteDataForm } from '@/components/DeleteDataForm';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Delete your data',
  description:
    'Request deletion of your Penny account and ledger data. Used for Play Store and privacy compliance.',
};

export default function DeleteDataPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 cm-ad-hero opacity-60" />
        <div className="cm-content relative mx-auto max-w-2xl px-4 py-16 md:px-6 md:py-20">
          <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Penny</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Delete your data</h1>
          <p className="mt-4 text-lg text-ink-secondary leading-relaxed">
            Submit the email on your Penny account. We verify ownership, then delete or anonymize
            your account and ledger data. Typical turnaround is within{' '}
            <strong className="font-semibold text-ink">30 days</strong>.
          </p>

          <DeleteDataForm />

          <div className="mt-12 space-y-4 border-t border-border pt-8 text-sm text-ink-secondary">
            <p>
              <strong className="text-ink">What we delete</strong> — account profile, sessions,
              personal and owned space ledgers, goals, and related app data tied to that email.
            </p>
            <p>
              <strong className="text-ink">Shared spaces</strong> — data in spaces owned by someone
              else may remain for other members; your membership and contributions are removed or
              anonymized where possible.
            </p>
            <p>
              <strong className="text-ink">Prefer email?</strong>{' '}
              <a
                className="font-medium text-brand underline-offset-4 hover:underline"
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Penny data deletion request')}`}
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              <Link href="/privacy" className="font-medium text-brand underline-offset-4 hover:underline">
                Privacy policy
              </Link>
              {' · '}
              <Link href="/contact" className="font-medium text-brand underline-offset-4 hover:underline">
                Contact
              </Link>
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
