import { z } from 'zod';

import type { Language } from '@/i18n/languages';

const PERCENT = /^(\d{1,3})(?:[.,](\d{1,2}))?$/;

/**
 * Commission typed as a percentage ("6", "5.5", "5,25") → basis points
 * (600, 550, 525). Empty means "no override" (null). Integer math only.
 */
export const commissionPercentSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const match = PERCENT.exec(value);
    const bps = match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : NaN;
    if (!(bps >= 0 && bps <= 10_000)) {
      ctx.addIssue({ code: 'custom', message: 'Expected a percentage from 0 to 100' });
      return z.NEVER;
    }
    return bps;
  });

/** 600 → "6%", 550 → "5,5%" (el) / "5.5%" (en). */
export function formatBps(bps: number, language: Language): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  const separator = language === 'el' ? ',' : '.';
  return `${whole}${fraction ? separator + fraction : ''}%`;
}

/** Basis points back to the text shown in the form field ("" for no override). */
export function bpsToPercentInput(bps: number | null, language: Language): string {
  return bps === null ? '' : formatBps(bps, language).replace('%', '');
}
