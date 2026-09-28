'use client';

import { cn } from '@/lib/utils';
import { PennyFigure, type PennyPose } from '@/components/penny/PennyFigure';

const SIZE_CLASS = {
  sm: 'h-10 w-10',
  nav: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-32 w-32 md:h-44 md:w-44',
} as const;

export type { PennyPose };

export function PennyAvatar({
  pose = 'idle',
  size = 'md',
  name = 'Penny',
  className,
  animate = true,
}: {
  pose?: PennyPose;
  size?: keyof typeof SIZE_CLASS;
  name?: string;
  className?: string;
  animate?: boolean;
}) {
  const compact = size === 'sm' || size === 'nav';

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-visible',
        SIZE_CLASS[size],
        !animate && 'cm-penny-static',
        className,
      )}
    >
      <PennyFigure
        pose={pose}
        title={name}
        compact={compact}
        className="h-full w-full"
      />
    </div>
  );
}
