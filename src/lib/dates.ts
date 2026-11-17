import { z } from 'zod';

import { isIsoDate, type IsoDate } from '../../supabase/functions/_shared/dates';

// One implementation for the app and the edge functions; see the file for the rules.
export {
  TIME_ZONE,
  addDays,
  daysBetween,
  isIsoDate,
  nightsBetween,
  stayNights,
  todayInAthens,
  type IsoDate,
} from '../../supabase/functions/_shared/dates';

/** Validates `YYYY-MM-DD` strings at boundaries (URL params, storage). */
export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'Expected a date as YYYY-MM-DD' });

const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/** A date typed in a form: "1/7/2027", "01.07.2027" or "2027-07-01" → "2027-07-01"; null if not a real date. */
export function parseDateInput(text: string): IsoDate | null {
  const value = text.trim();
  if (isIsoDate(value)) return value;
  const match = DMY.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

/** "2027-07-01" → "01/07/2027", the way dates are written in Greece. */
export function formatDateInput(date: IsoDate): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
