import { z } from 'zod';

import type { Language } from '@/i18n/languages';

/** Money is always integer euro cents. Never use floats for amounts. */
export type Cents = number;

export const centsSchema = z.number().int().refine(Number.isSafeInteger, 'Amount out of range');

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

const NUMBER_LOCALES: Record<Language, string> = { el: 'el-GR', en: 'en-IE' };

const formatters = new Map<Language, Intl.NumberFormat>();

function formatter(language: Language): Intl.NumberFormat {
  let f = formatters.get(language);
  if (!f) {
    f = new Intl.NumberFormat(NUMBER_LOCALES[language], { style: 'currency', currency: 'EUR' });
    formatters.set(language, f);
  }
  return f;
}

/**
 * Formats integer cents for display, e.g. `formatMoney(123456, 'el')` → "1.234,56 €"
 * and `formatMoney(123456, 'en')` → "€1,234.56". The only place cents become euros.
 */
export function formatMoney(cents: Cents, language: Language): string {
  if (!isCents(cents)) throw new RangeError(`Money must be integer cents, got ${cents}`);
  return formatter(language).format(cents / 100);
}
