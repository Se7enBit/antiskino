import type { Language } from '@/i18n';

/** The camping page route in a language: Greek at /c/<slug>, English at /en/c/<slug> (SPEC F2). */
export function campingPathname(language: Language) {
  return language === 'en' ? ('/en/c/[slug]' as const) : ('/c/[slug]' as const);
}
