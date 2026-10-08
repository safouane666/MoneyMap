import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/MarketingShell';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Legal',
  description: 'Legal documents for Penny — privacy, terms, and contact.',
};

const LINKS = [
  {
    href: '/privacy',
    title: 'Privacy Policy',
    body: 'How we collect, use, and protect account and ledger data.',
  },
  {
    href: '/terms',
    title: 'Terms of Use',
    body: 'Rules for using Penny on web and mobile.',
  },
  {
    href: '/contact',
    title: 'Contact',
    body: 'Reach support for product, privacy, or store questions.',
  },
  {
    href: '/reviews',
    title: 'Ratings & reviews',
    body: 'Community feedback and how to send your own review.',
  },
] as const;

export default function LegalPage() {
  return (
    <MarketingShell>
      <section className="cm-content mx-auto max-w-2xl px-4 py-16 md:px-6">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase text-brand">Penny</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">Legal</h1>
        <p className="mt-4 text-ink-secondary">
          Store and compliance documents for Penny. For anything not covered here, email{' '}
          <a className="font-medium text-brand underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <ul className="mt-10 space-y-6">
          {LINKS.map((item) => (
            <li key={item.href} className="border-t border-border pt-6">
              <Link href={item.href} className="text-lg font-semibold text-ink hover:text-brand">
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-ink-secondary">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
