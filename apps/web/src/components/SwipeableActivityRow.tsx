'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { EyeOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const ACTION_WIDTH = 88;
const COMMIT_RATIO = 0.55;

interface SwipeableActivityRowProps {
  children: ReactNode;
  onHide: () => void;
  onDelete: () => void;
  className?: string;
}

export function SwipeableActivityRow({
  children,
  onHide,
  onDelete,
  className,
}: SwipeableActivityRowProps) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const axisLocked = useRef<'x' | 'y' | null>(null);
  const pointerId = useRef<number | null>(null);

  const clamp = (value: number) => Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, value));

  const setLiveOffset = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const commitOrSnap = (next: number) => {
    if (next <= -ACTION_WIDTH * COMMIT_RATIO) {
      setLiveOffset(0);
      onDelete();
      return;
    }
    if (next >= ACTION_WIDTH * COMMIT_RATIO) {
      setLiveOffset(0);
      onHide();
      return;
    }
    if (next < -ACTION_WIDTH * 0.35) {
      setLiveOffset(-ACTION_WIDTH);
      return;
    }
    if (next > ACTION_WIDTH * 0.35) {
      setLiveOffset(ACTION_WIDTH);
      return;
    }
    setLiveOffset(0);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offsetRef.current;
    axisLocked.current = null;
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId || !draggingRef.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!axisLocked.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axisLocked.current === 'y') {
        draggingRef.current = false;
        setDragging(false);
        pointerId.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        return;
      }
    }

    if (axisLocked.current !== 'x') return;
    e.preventDefault();
    setLiveOffset(clamp(startOffset.current + dx));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    const wasHorizontal = axisLocked.current === 'x';
    draggingRef.current = false;
    setDragging(false);
    if (wasHorizontal) {
      commitOrSnap(offsetRef.current);
    }
    axisLocked.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-0 flex">
        <button
          type="button"
          className="flex w-[88px] flex-col items-center justify-center gap-1 bg-ink-secondary text-white"
          onClick={() => {
            setLiveOffset(0);
            onHide();
          }}
          aria-label={t('app.hide')}
        >
          <EyeOff className="h-4 w-4" />
          <span className="text-[11px] font-semibold">{t('app.hide')}</span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="flex w-[88px] flex-col items-center justify-center gap-1 bg-expense text-white"
          onClick={() => {
            setLiveOffset(0);
            onDelete();
          }}
          aria-label={t('app.delete')}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px] font-semibold">{t('app.delete')}</span>
        </button>
      </div>

      <div
        role="group"
        className={cn(
          'relative z-10 touch-pan-y bg-surface select-none',
          !dragging && 'transition-transform duration-[var(--cm-motion-medium)] ease-out',
        )}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {children}
      </div>
    </div>
  );
}
