import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Penny collects, uses, and protects your account and ledger data.',
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="cm-content mx-auto max-w-2xl px-4 py-16 md:px-6">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Penny</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated: 8 October 2026</p>

        <div className="mt-8 space-y-6 text-ink-secondary leading-relaxed">
          <p>
            Penny (“we”, “us”) is an AI money tracker for personal, household, and shared spaces.
            This policy explains what data we process so the product can sign you in, sync your
            ledger, and send optional reminders.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-ink">1. Data we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-ink">Account data</strong> — email address, display name,
                authentication identifiers (including Google sign-in when you choose it), and
                session tokens.
              </li>
              <li>
                <strong className="text-ink">Ledger data</strong> — transactions, categories,
                spaces, goals, recurring items, and settings you create.
              </li>
              <li>
                <strong className="text-ink">Device & usage</strong> — language preference, basic
                app diagnostics needed to keep sync reliable, and notification permission state on
                mobile when you enable reminders.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">2. How we use data</h2>
            <p className="mt-2">
              We use your data to operate Penny: authenticate you, sync ledgers across devices,
              power AI guidance you request, schedule optional reminders, and improve reliability.
              We do <strong className="text-ink">not</strong> sell your transaction history for
              advertising or use it for third-party ad targeting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">3. Sharing</h2>
            <p className="mt-2">
              Ledger data in a shared space is visible to members you invite. We use infrastructure
              providers (hosting, database, auth) solely to run the service. We may disclose data
              if required by law. We do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">4. Retention & deletion</h2>
            <p className="mt-2">
              We keep account and ledger data while your account is active. You may request account
              deletion by emailing{' '}
              <a className="font-medium text-brand underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              . After verification we delete or anonymize personal data except where retention is
              legally required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">5. Security</h2>
            <p className="mt-2">
              We use industry-standard protections (HTTPS, access controls, hashed credentials
              where applicable). No method of transmission is perfectly secure — keep your sign-in
              credentials private.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">6. Children</h2>
            <p className="mt-2">
              Penny is not directed at children under 13 (or the minimum age in your country). We
              do not knowingly collect data from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">7. Contact</h2>
            <p className="mt-2">
              Privacy questions:{' '}
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
