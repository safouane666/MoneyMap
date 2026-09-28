'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

const FEATURES = [
  {
    id: 'ledger',
    image: '/setup/feature-ledger.png',
    titleKey: 'setup.features.ledgerTitle',
    bodyKey: 'setup.features.ledgerBody',
  },
  {
    id: 'spaces',
    image: '/setup/feature-spaces.png',
    titleKey: 'setup.features.spacesTitle',
    bodyKey: 'setup.features.spacesBody',
  },
  {
    id: 'ai',
    image: '/setup/feature-ai.png',
    titleKey: 'setup.features.aiTitle',
    bodyKey: 'setup.features.aiBody',
  },
] as const;

export function SetupFeatureCarousel({ onComplete }: { onComplete?: () => void }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (index === FEATURES.length - 1) onComplete?.();
  }, [index, onComplete]);

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(FEATURES.length - 1, next)));
  };

  const feature = FEATURES[index];

  return (
    <div className="space-y-5">
      <div
        className="relative overflow-hidden rounded-[var(--cm-radius-feature)] border border-border bg-surface"
        onTouchStart={(e) => setTouchStart(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchStart == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touchStart) - touchStart;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          setTouchStart(null);
        }}
      >
        <div className="relative aspect-[4/3] w-full bg-canvas">
          <Image
            key={feature.id}
            src={feature.image}
            alt={t(feature.titleKey)}
            fill
            className="object-cover cm-feature-fade"
            sizes="(min-width: 768px) 480px, 100vw"
            priority
          />
        </div>
        <div className="space-y-2 p-5">
          <h2 className="text-xl font-semibold tracking-tight">{t(feature.titleKey)}</h2>
          <p className="text-sm leading-relaxed text-ink-secondary">{t(feature.bodyKey)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="h-11 rounded-[var(--cm-radius-control)] border border-border bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
        >
          {t('setup.features.prev')}
        </button>
        <div className="flex gap-2" role="tablist" aria-label={t('setup.features.dotsLabel')}>
          {FEATURES.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => go(i)}
              className={`h-2.5 rounded-full transition-all duration-[var(--cm-motion-fast)] ${
                i === index ? 'w-6 bg-brand' : 'w-2.5 bg-border'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === FEATURES.length - 1}
          className="h-11 rounded-[var(--cm-radius-control)] border border-border bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
        >
          {t('setup.features.next')}
        </button>
      </div>
    </div>
  );
}
