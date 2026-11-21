import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

type Props = {
  children: ReactNode;
  /** Web: the language the address asks for (camping pages, see languageOfPath). */
  urlLanguage?: Language | null;
};

/**
 * Holds the UI language in React state. Changes run in a transition, so on web
 * React finishes hydrating the pre-rendered HTML before re-rendering in the new
 * language, instead of hitting a hydration mismatch. Pages are pre-rendered in
 * Greek, except where the address asks for a language: those are pre-rendered
 * in it and keep it, so each address has one language for search engines.
 */
export function LanguageProvider({ children, urlLanguage = null }: Props) {
  const fromUrl = Platform.OS === 'web' ? urlLanguage : null;
  const [language, setLanguageState] = useState<Language>(
    () => fromUrl ?? (isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE),
  );
  const firstRun = useRef(true);

  const setLanguage = useCallback((next: Language) => {
    startTransition(() => setLanguageState(next));
  }, []);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  // Web, after hydration: the address's language when it has one (also when
  // moving to such a page), otherwise once the browser's.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (fromUrl) setLanguage(fromUrl);
    else if (firstRun.current) setLanguage(deviceLanguage());
    firstRun.current = false;
  }, [fromUrl, setLanguage]);

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
