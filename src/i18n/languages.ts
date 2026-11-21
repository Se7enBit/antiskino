export const LANGUAGES = ['el', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

/** Language of the pre-rendered static web pages (Greek-first product). */
export const DEFAULT_LANGUAGE: Language = 'el';

/** Used when none of the device's preferred languages is supported. */
export const FALLBACK_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function otherLanguage(language: Language): Language {
  return language === 'el' ? 'en' : 'el';
}

/**
 * Picks the first supported language from the device's preferred language codes
 * (e.g. `['de', 'el']` → `'el'`). Falls back to English.
 */
export function pickLanguage(preferred: readonly (string | null | undefined)[]): Language {
  for (const code of preferred) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

/**
 * The language a web address asks for. Camping pages carry it: Greek at
 * /c/<slug>, English at /en/c/<slug> (SPEC F2), so search engines get one
 * language per address. Elsewhere null: the visitor's own language applies.
 */
export function languageOfPath(pathname: string): Language | null {
  if (/^\/en\/c\/[^/]+/.test(pathname)) return 'en';
  if (/^\/c\/[^/]+/.test(pathname)) return 'el';
  return null;
}
