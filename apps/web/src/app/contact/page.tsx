import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { CONTACT_EMAIL } from '@/lib/contact';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Penny support for product, privacy, or store questions.',
};

export default function ContactPage() {
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Penny support')}`;

  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 cm-ad-hero opacity-60" />
        <div className="cm-content relative mx-auto max-w-2xl px-4 py-16 md:px-6 md:py-20">
          <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Penny</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Contact</h1>
          <p className="mt-4 text-lg text-ink-secondary">
            Questions about the app, privacy, billing, or Play Store listing? Reach us by email —
            we read every message.
          </p>

          <div className="mt-10 border-t border-border pt-8">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-muted">Email</p>
            <a
              href={mailto}
              className="mt-2 inline-block text-2xl font-semibold tracking-tight text-brand underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={mailto}>Send email</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/privacy">Privacy policy</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/terms">Terms of use</Link>
              </Button>
            </div>
          </div>

          <ul className="mt-12 space-y-4 text-sm text-ink-secondary">
            <li>
              <strong className="text-ink">Product & bugs</strong> — describe the device, app
              version, and steps to reproduce.
            </li>
            <li>
              <strong className="text-ink">Privacy & deletion</strong> — request access or account
              deletion from the email on your Penny account.
            </li>
            <li>
              <strong className="text-ink">Reviews</strong> — share feedback on the{' '}
              <Link href="/reviews" className="font-medium text-brand underline-offset-4 hover:underline">
                ratings & reviews
              </Link>{' '}
              page or by email.
            </li>
          </ul>
        </div>
      </section>
    </MarketingShell>
  );
}
