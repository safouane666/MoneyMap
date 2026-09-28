'use client';

import { useEffect, useState } from 'react';
import { PennyAvatar } from '@/components/penny/PennyAvatar';
import type { SetupPose } from '@/lib/setup-steps';

export function SetupCompanion({
  pose,
  bubble,
  name = 'Penny',
}: {
  pose: SetupPose;
  bubble: string;
  name?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [pose, bubble]);

  return (
    <div
      className={`flex items-start gap-3 md:flex-col md:items-center md:gap-4 ${
        shown ? 'cm-companion-in' : 'opacity-0'
      }`}
    >
      <PennyAvatar pose={pose} size="lg" name={name} />
      <div className="relative min-w-0 flex-1 md:w-full">
        <div
          className={`rounded-[var(--cm-radius-card)] border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink cm-shadow ${
            shown ? 'cm-bubble-in' : 'opacity-0'
          }`}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">{name}</p>
          <p>{bubble}</p>
        </div>
        <span
          aria-hidden
          className="absolute -start-1.5 top-5 hidden h-3 w-3 rotate-45 border-b border-s border-border bg-surface md:start-1/2 md:top-auto md:-mt-1.5 md:-translate-x-1/2 md:border-b-0 md:border-e-0 md:border-s md:border-t rtl:md:translate-x-1/2"
        />
      </div>
    </div>
  );
}
