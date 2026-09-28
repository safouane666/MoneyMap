'use client';

import { ChevronsUpDown, Plus } from 'lucide-react';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace } from '@/lib/demo-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n';
import { CreateSpaceDialog } from '@/components/CreateSpaceDialog';

export function SpaceSwitcher() {
  const { state, setSpace } = useLedger();
  const { t } = useI18n();
  const active = getActiveSpace(state);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[10rem] justify-between gap-2">
            <span className="truncate">{active.name || t('spaces.title')}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{t('spaces.title')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {state.spaces.map((space) => (
            <DropdownMenuItem key={space.id} onSelect={() => setSpace(space.id)}>
              <span className="flex-1">{space.name}</span>
              <span className="text-xs text-ink-muted">{space.currency}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateSpaceDialog
        trigger={
          <Button type="button" variant="outline" size="icon" aria-label={t('spaces.create')}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}
