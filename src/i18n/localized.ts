import { otherLanguage, type Language } from './languages';

/** Shape of translatable DB text fields: `jsonb {"el": …, "en": …}`. */
export type LocalizedText = Partial<Record<Language, string>>;

/**
 * Returns the text in `language`, falling back to the other language.
 * Accepts `unknown` because the value comes from a jsonb column; anything that
 * isn't an object with non-empty string values yields `''`.
 */
export function localized(value: unknown, language: Language): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const texts = value as Record<string, unknown>;
  for (const candidate of [language, otherLanguage(language)]) {
    const text = texts[candidate];
    if (typeof text === 'string' && text.trim() !== '') return text;
  }
  return '';
}
