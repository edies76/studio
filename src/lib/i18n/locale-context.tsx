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
import {
  DEFAULT_LOCALE,
  messages,
  type Locale,
  type MessageKey,
} from './messages';

const STORAGE_KEY = 'docs-studio-locale';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === 'en' || saved === 'es') setLocaleState(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (ready) document.documentElement.lang = locale;
  }, [locale, ready]);

  const t = useCallback(
    (key: MessageKey) => {
      const table = messages[locale] || messages.en;
      return table[key] || messages.en[key] || key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback if used outside provider
    return {
      locale: DEFAULT_LOCALE as Locale,
      setLocale: (_: Locale) => {},
      t: (key: MessageKey) => messages.en[key] || key,
    };
  }
  return ctx;
}
