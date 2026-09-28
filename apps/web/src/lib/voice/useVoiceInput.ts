'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoicePhase = 'idle' | 'listening' | 'review' | 'sending';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  /** Chromium on-device flag when language packs are installed. */
  processLocally?: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [index: number]: { isFinal?: boolean; length?: number; [index: number]: { transcript?: string } };
          item?: (index: number) => { isFinal?: boolean; length?: number; [index: number]: { transcript?: string } };
        };
      }) => void)
    | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionStatic = {
  available?: (opts: {
    langs: string[];
    processLocally?: boolean;
  }) => Promise<'available' | 'unavailable' | 'downloadable' | string>;
  install?: (opts: { langs: string[] }) => Promise<boolean>;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: (new () => SpeechRecognitionLike) & SpeechRecognitionStatic;
    webkitSpeechRecognition?: (new () => SpeechRecognitionLike) & SpeechRecognitionStatic;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getSpeechRecognitionStatic(): SpeechRecognitionStatic | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the constructor exists (Chrome/Edge/Android; often missing or flaky on iOS Safari). */
export function isVoiceSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

/** iOS / iPadOS Safari (and Chrome-on-iOS WebKit) — Web Speech is unreliable or absent. */
export function isSafariIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (!iOS && !iPadOs) return false;
  // All iOS browsers use WebKit; treat as Safari-like for STT messaging.
  return true;
}

function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

type SpeechResultLike = {
  isFinal?: boolean;
  length?: number;
  [index: number]: { transcript?: string };
};

function readAlternativeTranscript(result: SpeechResultLike): string {
  const indexed = result[0]?.transcript;
  if (indexed?.trim()) return indexed.trim();
  const itemFn = (result as { item?: (index: number) => { transcript?: string } }).item;
  if (typeof itemFn === 'function') {
    return (itemFn.call(result, 0)?.transcript ?? '').trim();
  }
  return '';
}

/** Merge SpeechRecognition results. Exported for tests. */
export function mergeSpeechResults(
  priorFinals: string,
  event: {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: SpeechResultLike;
      item?: (index: number) => SpeechResultLike;
    };
  },
): { finals: string; interim: string; combined: string } {
  let finals = priorFinals;
  let interim = '';
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result =
      event.results[i] ??
      (typeof event.results.item === 'function' ? event.results.item(i) : undefined);
    if (!result) continue;
    const piece = readAlternativeTranscript(result);
    if (!piece) continue;
    if (result.isFinal) finals = `${finals} ${piece}`.trim();
    else interim = `${interim} ${piece}`.trim();
  }
  const combined = `${finals} ${interim}`.trim();
  return { finals, interim, combined };
}

/**
 * Prefer on-device STT only when the language pack is already installed.
 * Never call install() here — a half-ready pack with processLocally=true
 * yields silent empty transcripts (no usable onresult).
 */
async function preferProcessLocally(lang: string): Promise<boolean> {
  const staticApi = getSpeechRecognitionStatic();
  if (!staticApi?.available) return false;
  try {
    const status = await staticApi.available({ langs: [lang], processLocally: true });
    return status === 'available';
  } catch {
    /* ignore — fall back to cloud Web Speech */
  }
  return false;
}

/**
 * idle → listening (until Done/Cancel) → review → sending → idle
 *
 * - Desktop: continuous recognition
 * - Mobile: one-shot + gentle restart (continuous is unreliable)
 * - Use on-device STT only when language packs are already installed
 * - Never jump to review on engine onend — only on Done
 * - Audio never leaves the Clear Money backend (browser STT only)
 */
export function useVoiceInput(options: { lang: string }) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [safariHint, setSafariHint] = useState(false);
  const [processLocally, setProcessLocally] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionRef = useRef(0);
  const activeRef = useRef(false);
  const transcriptRef = useRef('');
  const finalsRef = useRef('');
  const phaseRef = useRef<VoicePhase>('idle');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false);
  const processLocallyRef = useRef(false);

  const setPhaseBoth = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const ok = isVoiceSupported();
    setSupported(ok);
    setSafariHint(isSafariIosLike() && !ok);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void preferProcessLocally(options.lang || 'en-US').then((local) => {
      if (cancelled) return;
      processLocallyRef.current = local;
      setProcessLocally(local);
    });
    return () => {
      cancelled = true;
    };
  }, [options.lang]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const writeLive = useCallback((text: string) => {
    transcriptRef.current = text;
    setLiveTranscript(text);
  }, []);

  const stopEngine = useCallback(
    (mode: 'stop' | 'abort' = 'abort') => {
      clearRestartTimer();
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      startingRef.current = false;
      if (!rec) return;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        if (mode === 'abort' && typeof rec.abort === 'function') rec.abort();
        else rec.stop();
      } catch {
        /* ignore */
      }
    },
    [clearRestartTimer],
  );

  useEffect(() => {
    return () => {
      activeRef.current = false;
      sessionRef.current += 1;
      stopEngine('abort');
    };
  }, [stopEngine]);

  const goReview = useCallback(
    (text: string, engineMode: 'stop' | 'abort' = 'abort') => {
      activeRef.current = false;
      stopEngine(engineMode);
      const cleaned = text.trim();
      transcriptRef.current = cleaned;
      setLiveTranscript(cleaned);
      setFinalTranscript(cleaned);
      setError(cleaned ? null : 'empty');
      setPhaseBoth('review');
    },
    [setPhaseBoth, stopEngine],
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('unsupported');
      setSupported(false);
      setSafariHint(isSafariIosLike());
      return false;
    }

    sessionRef.current += 1;
    const session = sessionRef.current;
    activeRef.current = true;
    stopEngine('abort');

    finalsRef.current = '';
    transcriptRef.current = '';
    writeLive('');
    setFinalTranscript('');
    setError(null);
    setPhaseBoth('listening');

    const mobile = isMobileUa();

    const armEngine = () => {
      if (sessionRef.current !== session || !activeRef.current || phaseRef.current !== 'listening') {
        return;
      }
      if (startingRef.current || recognitionRef.current) return;

      startingRef.current = true;
      const recognition = new Ctor();
      recognition.lang = options.lang || 'en-US';
      recognition.continuous = !mobile;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      if (processLocallyRef.current) {
        try {
          recognition.processLocally = true;
        } catch {
          /* older engines ignore */
        }
      }

      recognition.onstart = () => {
        startingRef.current = false;
      };

      recognition.onresult = (event) => {
        if (sessionRef.current !== session || !activeRef.current) return;
        const merged = mergeSpeechResults(finalsRef.current, event);
        finalsRef.current = merged.finals;
        const next = merged.combined || finalsRef.current;
        if (next) writeLive(next);
      };

      recognition.onerror = (event) => {
        if (sessionRef.current !== session) return;
        const code = event?.error ?? '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          activeRef.current = false;
          clearRestartTimer();
          setError('permission');
          recognitionRef.current = null;
          startingRef.current = false;
          setPhaseBoth('idle');
          return;
        }
        if (
          processLocallyRef.current &&
          (code === 'language-not-supported' || code === 'network')
        ) {
          // On-device pack missing / broken — drop to cloud Web Speech and restart now.
          processLocallyRef.current = false;
          setProcessLocally(false);
          try {
            recognition.processLocally = false;
          } catch {
            /* ignore */
          }
          clearRestartTimer();
          startingRef.current = false;
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          try {
            if (typeof recognition.abort === 'function') recognition.abort();
            else recognition.stop();
          } catch {
            /* ignore */
          }
          restartTimerRef.current = setTimeout(() => {
            restartTimerRef.current = null;
            if (sessionRef.current !== session || !activeRef.current) return;
            if (phaseRef.current !== 'listening') return;
            try {
              armEngine();
            } catch {
              setError('restart');
            }
          }, 200);
          return;
        }
        // no-speech / aborted / audio-capture → let onend restart while active
      };

      recognition.onend = () => {
        startingRef.current = false;
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        if (sessionRef.current !== session || !activeRef.current) return;
        if (phaseRef.current !== 'listening') return;

        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (sessionRef.current !== session || !activeRef.current) return;
          if (phaseRef.current !== 'listening') return;
          try {
            armEngine();
          } catch {
            setError('restart');
          }
        }, mobile ? 280 : 450);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        startingRef.current = false;
        recognitionRef.current = null;
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (sessionRef.current !== session || !activeRef.current) return;
          try {
            armEngine();
          } catch {
            setError('start');
          }
        }, 320);
      }
    };

    try {
      armEngine();
      return true;
    } catch {
      activeRef.current = false;
      recognitionRef.current = null;
      startingRef.current = false;
      setPhaseBoth('idle');
      setError('start');
      return false;
    }
  }, [clearRestartTimer, options.lang, setPhaseBoth, stopEngine, writeLive]);

  const finishListening = useCallback(
    (visibleText?: string) => {
      if (phaseRef.current !== 'listening') return;
      // Prefer on-screen text, then live ref, then accumulated finals.
      // Important: empty string must NOT win via ?? over a non-empty ref.
      const fromUi = (visibleText ?? '').trim();
      const snapshot = (fromUi || transcriptRef.current.trim() || finalsRef.current.trim()).trim();
      sessionRef.current += 1;
      activeRef.current = false;
      // stop() (not abort) lets engines flush a final result when possible
      goReview(snapshot, 'stop');
    },
    [goReview],
  );

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    activeRef.current = false;
    stopEngine('abort');
    finalsRef.current = '';
    transcriptRef.current = '';
    setLiveTranscript('');
    setFinalTranscript('');
    setError(null);
    setPhaseBoth('idle');
  }, [setPhaseBoth, stopEngine]);

  const updateReviewText = useCallback((text: string) => {
    transcriptRef.current = text;
    setFinalTranscript(text);
    setLiveTranscript(text);
    if (text.trim()) setError(null);
  }, []);

  const beginSending = useCallback(() => {
    setPhaseBoth('sending');
  }, [setPhaseBoth]);

  const endSending = useCallback(() => {
    finalsRef.current = '';
    transcriptRef.current = '';
    setLiveTranscript('');
    setFinalTranscript('');
    setError(null);
    setPhaseBoth('idle');
  }, [setPhaseBoth]);

  return {
    phase,
    liveTranscript,
    finalTranscript,
    error,
    supported,
    safariHint,
    processLocally,
    startListening,
    finishListening,
    cancel,
    updateReviewText,
    beginSending,
    endSending,
  };
}
