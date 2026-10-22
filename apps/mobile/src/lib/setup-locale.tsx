import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { t as translate } from './i18n';
import {
  loadSetupSession,
  saveSetupSession,
  type SetupLanguage,
} from './setup-session';

type SetupLocaleContextValue = {
  locale: SetupLanguage;
  ready: boolean;
  setLocale: (next: SetupLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const SetupLocaleContext = createContext<SetupLocaleContextValue | null>(null);

export function SetupLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SetupLanguage>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadSetupSession().then((session) => {
      setLocaleState(session.language);
      setReady(true);
    });
  }, []);

  const setLocale = useCallback(async (next: SetupLanguage) => {
    setLocaleState(next);
    await saveSetupSession({ language: next });
  }, []);

  const value = useMemo<SetupLocaleContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, ready, setLocale],
  );

  return <SetupLocaleContext.Provider value={value}>{children}</SetupLocaleContext.Provider>;
}

/** Prefer setup provider; fall back to loading the saved session (tabs / auth). */
export function useSetupLocale(): SetupLocaleContextValue {
  const ctx = useContext(SetupLocaleContext);
  const [locale, setLocaleState] = useState<SetupLanguage>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ctx) return;
    void loadSetupSession().then((session) => {
      setLocaleState(session.language);
      setReady(true);
    });
  }, [ctx]);

  const setLocale = useCallback(async (next: SetupLanguage) => {
    setLocaleState(next);
    await saveSetupSession({ language: next });
  }, []);

  const fallback = useMemo<SetupLocaleContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, ready, setLocale],
  );

  return ctx ?? fallback;
}
