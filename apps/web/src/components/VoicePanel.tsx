'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Mic, RotateCcw, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VoicePhase } from '@/lib/voice/useVoiceInput';

export function VoicePanel({
  phase,
  liveTranscript,
  reviewText,
  errorMessage,
  labels,
  onDoneListening,
  onCancel,
  onReviewChange,
  onSend,
  onRerecord,
}: {
  phase: Exclude<VoicePhase, 'idle'>;
  liveTranscript: string;
  reviewText: string;
  errorMessage?: string | null;
  labels: {
    listening: string;
    listeningHint: string;
    speakNow: string;
    done: string;
    cancel: string;
    reviewTitle: string;
    reviewHint: string;
    send: string;
    rerecord: string;
    sending: string;
    sendingHint: string;
    queued: string;
    processing: string;
  };
  onDoneListening: (visibleText: string) => void;
  onCancel: () => void;
  onReviewChange: (value: string) => void;
  onSend: (text: string) => void;
  onRerecord: () => void;
}) {
  // Single source for review edits — reseed whenever we enter review with new parent text
  const [draft, setDraft] = useState(reviewText);
  /** Last non-empty live text — survives a stale render when Done is tapped. */
  const lastHeardRef = useRef('');
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (phase === 'review') {
      setDraft(reviewText);
    }
  }, [phase, reviewText]);

  useEffect(() => {
    if (phase === 'listening' && prevPhaseRef.current !== 'listening') {
      lastHeardRef.current = '';
    }
    prevPhaseRef.current = phase;
    const trimmed = liveTranscript.trim();
    if (phase === 'listening' && trimmed) {
      lastHeardRef.current = trimmed;
    }
  }, [phase, liveTranscript]);

  if (phase === 'listening') {
    const shown = liveTranscript.trim() || lastHeardRef.current;
    return (
      <div
        data-testid="voice-listening"
        className="mt-3 space-y-3 rounded-[var(--cm-radius-card)] border border-expense/30 bg-[color-mix(in_srgb,var(--cm-expense)_8%,var(--cm-surface))] p-4"
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-expense text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-expense/35" />
            <Mic className="relative h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{labels.listening}</p>
            <p className="text-xs text-ink-secondary">{labels.listeningHint}</p>
          </div>
        </div>
        <div className="min-h-16 rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 py-2">
          <p className="whitespace-pre-wrap text-sm text-ink">{shown || labels.speakNow}</p>
        </div>
        {errorMessage ? <p className="text-xs text-expense">{errorMessage}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
            {labels.cancel}
          </Button>
          <Button
            type="button"
            data-testid="voice-done"
            onClick={() => onDoneListening(shown || lastHeardRef.current)}
          >
            <Square className="h-4 w-4" />
            {labels.done}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div
        data-testid="voice-review"
        className="mt-3 space-y-3 rounded-[var(--cm-radius-card)] border border-brand/30 bg-brand-tint/50 p-4"
      >
        <div>
          <p className="text-sm font-semibold text-ink">{labels.reviewTitle}</p>
          <p className="mt-0.5 text-xs text-ink-secondary">{labels.reviewHint}</p>
        </div>
        <textarea
          data-testid="voice-review-text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onReviewChange(e.target.value);
          }}
          rows={3}
          className="w-full resize-none rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          placeholder={labels.speakNow}
        />
        {errorMessage ? <p className="text-xs text-expense">{errorMessage}</p> : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
            {labels.cancel}
          </Button>
          <Button type="button" variant="secondary" onClick={onRerecord}>
            <RotateCcw className="h-4 w-4" />
            {labels.rerecord}
          </Button>
          <Button
            type="button"
            data-testid="voice-send"
            onClick={() => onSend(draft.trim())}
            disabled={!draft.trim()}
          >
            <Check className="h-4 w-4" />
            {labels.send}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="voice-sending"
      className="mt-3 space-y-3 rounded-[var(--cm-radius-card)] border border-brand/40 bg-brand-tint p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{labels.sending}</p>
          <p className="text-xs text-ink-secondary">{labels.sendingHint}</p>
        </div>
      </div>
      <ol className="space-y-2 text-xs text-ink-secondary">
        <li className="flex items-center gap-2 text-income">
          <Check className="h-3.5 w-3.5" />
          {labels.queued}
        </li>
        <li className="flex items-center gap-2 text-brand">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {labels.processing}
        </li>
      </ol>
      {draft || reviewText ? (
        <p className="rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 py-2 text-sm text-ink">
          “{draft || reviewText}”
        </p>
      ) : null}
    </div>
  );
}
