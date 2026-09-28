'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { directionForLocale } from '@clear-money/domain';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import ar from '@/messages/ar.json';
import { loadSetupSession, saveSetupSession, type SetupLanguage } from '@/lib/setup-session';

type Messages = typeof en;

const catalogs: Record<SetupLanguage, Messages> = {
  en,
  fr: fr as Messages,
  ar: ar as Messages,
};

type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
        : Prefix extends ''
          ? K
          : `${Prefix}.${K}`;
    }[keyof T & string]
  : never;

export type MessageKey = NestedKeyOf<Messages>;

function getByPath(obj: Messages, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === 'string' ? cur : path;
}

interface I18nContextValue {
  locale: SetupLanguage;
  dir: 'ltr' | 'rtl';
  t: (key: MessageKey | string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: SetupLanguage) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SetupLanguage>('en');

  useEffect(() => {
    const session = loadSetupSession();
    setLocaleState(session.language);
  }, []);

  const setLocale = useCallback((next: SetupLanguage) => {
    setLocaleState(next);
    saveSetupSession({ language: next });
  }, []);

  const dir = directionForLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key, vars) => {
        let text = getByPath(catalogs[locale], key);
        if (vars) {
          for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
          }
        }
        return text;
      },
    }),
    [locale, dir, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
