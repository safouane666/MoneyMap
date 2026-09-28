'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLedger } from '@/lib/ledger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SPACE_TYPES = ['personal', 'household', 'shared'] as const;

export function CreateSpaceDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { createSpace, offline } = useLedger();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof SPACE_TYPES)[number]>('shared');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const created = await createSpace({ name, type });
      setName('');
      setType('shared');
      setOpen(false);
      router.push(`/app/spaces/${created.id}#members`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('spaces.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" className="gap-2">
            <Plus className="h-4 w-4" />
            {t('spaces.create')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('spaces.createTitle')}</DialogTitle>
          <DialogDescription>{t('spaces.createBody')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="space-name">{t('spaces.name')}</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('spaces.namePlaceholder')}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-type">{t('spaces.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as (typeof SPACE_TYPES)[number])}>
              <SelectTrigger id="space-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACE_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`spaces.types.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {offline ? <p className="text-sm text-expense">{t('spaces.needOnline')}</p> : null}
          {error ? <p className="text-sm text-expense">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={loading || offline || !name.trim()}>
              {loading ? t('spaces.creating') : t('spaces.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
