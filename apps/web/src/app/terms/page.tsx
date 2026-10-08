import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms governing your use of Penny, the AI money tracker.',
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="cm-content mx-auto max-w-2xl px-4 py-16 md:px-6">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Penny</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">Terms of Use</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated: 8 October 2026</p>

        <div className="mt-8 space-y-6 text-ink-secondary leading-relaxed">
          <p>
            By accessing Penny (web or mobile), you agree to these Terms. If you do not agree, do
            not use the service.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-ink">1. The service</h2>
            <p className="mt-2">
              Penny is a money-tracking tool with optional AI guidance, spaces, goals, and
              reminders. Features may change as we improve the product. Free and paid tiers may
              differ; pricing details are shown on the Pricing page when billing is enabled.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">2. Your account</h2>
            <p className="mt-2">
              You are responsible for accurate entries, for keeping credentials secure, and for
              activity under your account. You must be old enough to form a binding contract in
              your jurisdiction (and at least 13).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">3. Acceptable use</h2>
            <p className="mt-2">
              Do not misuse Penny: no unlawful activity, no attempts to breach security, scrape at
              abusive rates, or infringe others’ rights. Shared-space invites should only go to
              people you trust with that ledger.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">4. Not financial advice</h2>
            <p className="mt-2">
              Penny and its AI companion provide informational tools only. Nothing in the app is
              professional financial, tax, or investment advice. Decisions you make remain yours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">5. Availability</h2>
            <p className="mt-2">
              We aim for reliable sync but do not guarantee uninterrupted service. Penny is
              provided “as is” to the fullest extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">6. Liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, we are not liable for indirect, incidental,
              or consequential damages arising from your use of Penny, including decisions based on
              balances, safe-to-spend estimates, or AI suggestions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">7. Changes</h2>
            <p className="mt-2">
              We may update these Terms. Continued use after changes means you accept the updated
              Terms. Material updates will be reflected by the “Last updated” date on this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">8. Contact</h2>
            <p className="mt-2">
              Questions about these Terms:{' '}
              <a className="font-medium text-brand underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>

        <p className="mt-10">
          <Link href="/" className="text-brand underline-offset-4 hover:underline">
            Back home
          </Link>
        </p>
      </article>
    </MarketingShell>
  );
}
