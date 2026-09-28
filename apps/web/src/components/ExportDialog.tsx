'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { formatMinorUnits } from '@clear-money/domain';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace, getSpaceTransactions } from '@/lib/demo-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PermissionGate } from '@/components/PermissionGate';

/**
 * Client-side CSV only (intentional for v1). PDF/XLSX API jobs return metadata
 * without file bytes; this dialog does not poll GET /jobs/:id.
 */
export function ExportDialog() {
  const { t, locale } = useI18n();
  const { state } = useLedger();
  const space = getActiveSpace(state);
  const [open, setOpen] = useState(false);

  const exportCsv = () => {
    const rows = getSpaceTransactions(state, space.id);
    const header = 'id,type,amount,currency,description,occurredAt\n';
    const body = rows
      .map((r) =>
        [
          r.id,
          r.type,
          formatMinorUnits(r.amountMinor, r.currency, locale).replace(/,/g, ''),
          r.currency,
          JSON.stringify(r.description ?? ''),
          r.occurredAt,
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${space.name.toLowerCase()}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <PermissionGate role={space.role} action="export">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Download className="h-4 w-4" />
            {t('app.export')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('app.export')}</DialogTitle>
            <DialogDescription>
              Download a CSV of confirmed transactions for {space.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={exportCsv}>{t('app.export')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
