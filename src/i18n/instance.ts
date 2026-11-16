import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  otherLanguage,
  pickLanguage,
  type Language,
} from './languages';
import el from './locales/el.json';
import en from './locales/en.json';

export const resources = {
  el: { translation: el },
  en: { translation: en },
} as const;

export function deviceLanguage(): Language {
  return pickLanguage(getLocales().map((locale) => locale.languageCode));
}

// Static web pages are pre-rendered in DEFAULT_LANGUAGE so the HTML matches on
// hydration; LanguageProvider switches to the browser's language afterwards.
// Native apps start directly in the device language.
export const initialLanguage: Language =
  Platform.OS === 'web' ? DEFAULT_LANGUAGE : deviceLanguage();

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: {
    el: [otherLanguage('el')],
    en: [otherLanguage('en')],
    default: [DEFAULT_LANGUAGE],
  },
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
}

export default i18n;
