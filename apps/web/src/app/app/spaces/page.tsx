'use client';

import Link from 'next/link';
import { can } from '@clear-money/domain';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateSpaceDialog } from '@/components/CreateSpaceDialog';

export default function SpacesPage() {
  const { t } = useI18n();
  const { state } = useLedger();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('spaces.title')}</h1>
        <CreateSpaceDialog />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {state.spaces.map((space) => (
          <li
            key={space.id}
            className="rounded-[var(--cm-radius-card)] border border-border bg-surface p-5 cm-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{space.name}</h2>
                <p className="mt-1 text-sm text-ink-secondary">{space.currency}</p>
              </div>
              <Badge variant="secondary">{space.role}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/spaces/${space.id}`}>{t('spaces.open')}</Link>
              </Button>
              {can(space.role, 'invite') ? (
                <Button asChild size="sm">
                  <Link href={`/app/spaces/${space.id}#members`}>{t('spaces.invite')}</Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!state.spaces.length ? (
        <p className="text-sm text-ink-secondary">{t('spaces.empty')}</p>
      ) : null}
    </div>
  );
}
