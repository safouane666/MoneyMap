import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-[var(--cm-radius-card)] border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface text-ink',
        warning: 'border-warning/30 bg-[color-mix(in_srgb,var(--cm-warning)_10%,white)] text-ink',
        destructive:
          'border-expense/30 bg-[color-mix(in_srgb,var(--cm-expense)_10%,white)] text-ink',
        info: 'border-info/30 bg-[color-mix(in_srgb,var(--cm-info)_10%,white)] text-ink',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none', className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm text-ink-secondary', className)} {...props} />;
}
