import type { Language } from '@/i18n/languages';

/** Two text fields → jsonb {"el", "en"}, leaving out empty languages. */
export function toLocalized(el: string, en: string): { el?: string; en?: string } {
  return { ...(el ? { el } : {}), ...(en ? { en } : {}) };
}

/** One language of a jsonb text field for editing ('' when missing). Use localized() for display. */
export function textIn(value: unknown, language: Language): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const text = (value as Record<string, unknown>)[language];
  return typeof text === 'string' ? text : '';
}
