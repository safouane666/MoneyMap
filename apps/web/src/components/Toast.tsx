'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { PennyAvatar, type PennyPose } from '@/components/penny/PennyAvatar';

interface ToastPayload {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  fromPenny?: boolean;
  pose?: PennyPose;
  title?: string;
}

interface ToastContextValue {
  showToast: (payload: ToastPayload) => void;
  showPennyTip: (payload: Omit<ToastPayload, 'fromPenny'> & { message: string }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const showToast = useCallback((payload: ToastPayload) => {
    setToast(payload);
    window.setTimeout(() => setToast(null), payload.fromPenny ? 7000 : 5000);
  }, []);

  const showPennyTip = useCallback(
    (payload: Omit<ToastPayload, 'fromPenny'> & { message: string }) => {
      showToast({
        ...payload,
        fromPenny: true,
        pose: payload.pose ?? 'wave',
        title: payload.title ?? 'Penny',
      });
    },
    [showToast],
  );

  const value = useMemo(() => ({ showToast, showPennyTip }), [showToast, showPennyTip]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className={`fixed bottom-24 start-1/2 z-[60] flex w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-[var(--cm-radius-control)] border border-border bg-surface px-4 py-3 text-sm cm-shadow md:bottom-8 rtl:translate-x-1/2 ${
            toast.fromPenny ? 'items-start' : 'justify-between'
          }`}
        >
          {toast.fromPenny ? (
            <>
              <PennyAvatar pose={toast.pose ?? 'hello'} size="nav" name={toast.title ?? 'Penny'} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                {toast.title ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                    {toast.title}
                  </p>
                ) : null}
                <p className="mt-0.5 leading-snug text-ink">{toast.message}</p>
                {toast.actionLabel && toast.onAction ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => {
                      toast.onAction?.();
                      setToast(null);
                    }}
                  >
                    {toast.actionLabel}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <span className="flex-1">{toast.message}</span>
              {toast.actionLabel && toast.onAction ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                >
                  {toast.actionLabel}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
