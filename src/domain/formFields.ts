import { z } from 'zod';

import { parseDateInput } from '@/lib/dates';

/** Form text fields shared by the partner forms. Inputs are strings; outputs are typed. */

export const text = (max: number) => z.string().trim().max(max);

/** "12" → 12, within min…max. */
export const wholeNumber = (min: number, max: number) =>
  z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));

/** "01/07/2027" (or "1.7.2027", "2027-07-01") → "2027-07-01". */
export const dateInput = z.string().transform((value, ctx) => {
  const date = parseDateInput(value);
  if (!date) {
    ctx.addIssue({ code: 'custom', message: 'Expected a date like 01/07/2027' });
    return z.NEVER;
  }
  return date;
});
