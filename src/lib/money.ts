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

const EUROS = /^(\d{1,6})(?:[.,](\d{1,2}))?$/;

/** Euros typed in a form ("12", "12,5", "12.50") → cents; empty → null. Integer math only. */
export const eurosInputSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const match = EUROS.exec(value);
    if (!match) {
      ctx.addIssue({ code: 'custom', message: 'Expected an amount in euros' });
      return z.NEVER;
    }
    return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  });

/** Cents → form text: 1250 → "12,50" (el) / "12.50" (en); whole euros have no decimals. */
export function centsToInput(cents: Cents | null, language: Language): string {
  if (cents === null) return '';
  const whole = Math.trunc(cents / 100);
  const rest = cents % 100;
  return rest === 0
    ? String(whole)
    : `${whole}${language === 'el' ? ',' : '.'}${String(rest).padStart(2, '0')}`;
}
