'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Archive, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const ACTION_WIDTH = 88;

interface SwipeableActivityRowProps {
  children: ReactNode;
  onEdit: () => void;
  onArchive: () => void;
  className?: string;
}

/** Swipe reveals buttons; user must click a button to act (can swipe back to close). */
export function SwipeableActivityRow({
  children,
  onEdit,
  onArchive,
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

  const snap = (next: number) => {
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
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axisLocked.current === 'y') {
        draggingRef.current = false;
        setDragging(false);
        return;
      }
    }
    if (axisLocked.current !== 'x') return;
    setLiveOffset(clamp(startOffset.current + dx));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    if (draggingRef.current && axisLocked.current === 'x') {
      snap(clamp(startOffset.current + (e.clientX - startX.current)));
    }
    draggingRef.current = false;
    setDragging(false);
    pointerId.current = null;
    axisLocked.current = null;
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-0 flex">
        <button
          type="button"
          className="flex w-[88px] flex-col items-center justify-center gap-1 bg-info text-xs font-bold text-white"
          onClick={() => {
            setLiveOffset(0);
            onEdit();
          }}
        >
          <Pencil className="h-4 w-4" />
          {t('app.edit')}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="flex w-[88px] flex-col items-center justify-center gap-1 bg-ink-secondary text-xs font-bold text-white"
          onClick={() => {
            setLiveOffset(0);
            onArchive();
          }}
        >
          <Archive className="h-4 w-4" />
          {t('app.archive')}
        </button>
      </div>
      <div
        className={cn('relative bg-surface touch-pan-y', dragging && 'select-none')}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 160ms ease' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
