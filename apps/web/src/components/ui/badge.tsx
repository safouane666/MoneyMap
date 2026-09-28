import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--cm-radius-pill)] border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-tint text-brand',
        secondary: 'border-transparent bg-canvas text-ink-secondary',
        income: 'border-transparent bg-[color-mix(in_srgb,var(--cm-income)_15%,white)] text-income',
        expense:
          'border-transparent bg-[color-mix(in_srgb,var(--cm-expense)_15%,white)] text-expense',
        outline: 'border-border text-ink-secondary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
