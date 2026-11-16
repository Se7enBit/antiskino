import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
// The one place allowed to use react-i18next directly (see eslint.config.js).
// eslint-disable-next-line no-restricted-imports
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import i18n, { deviceLanguage } from './instance';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './languages';

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageState | null>(null);

/**
 * Holds the UI language in React state. Changes run in a transition, so on web
 * React finishes hydrating the pre-rendered (Greek) HTML before re-rendering
 * in the new language, instead of hitting a hydration mismatch.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE,
  );

  const setLanguage = useCallback((next: Language) => {
    startTransition(() => setLanguageState(next));
  }, []);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    if (Platform.OS === 'web') setLanguage(deviceLanguage());
  }, [setLanguage]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext value={value}>{children}</LanguageContext>;
}

export function useLanguage(): LanguageState {
  const state = useContext(LanguageContext);
  if (!state) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return state;
}

/** `t` bound to the current UI language. Use this instead of react-i18next's useTranslation. */
export function useT() {
  const { language } = useLanguage();
  return useTranslation(undefined, { lng: language }).t;
}
