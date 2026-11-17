import { z } from 'zod';

import {
  addDays,
  daysBetween,
  isIsoDate,
  type IsoDate,
} from '../../supabase/functions/_shared/dates';

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

// ---------------------------------------------------------------------------
// Calendar helpers (date pickers). Weeks start on Monday, as in Greece.
// ---------------------------------------------------------------------------

/** A known Monday, to count weekdays from. */
const MONDAY = '2024-01-01';

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: IsoDate): number {
  return ((daysBetween(MONDAY, date) % 7) + 7) % 7;
}

/** "2027-07-14" → "2027-07-01". */
export function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 8)}01`;
}

/** The first day of the month `months` away from `month` (a month start). */
export function addMonths(month: IsoDate, months: number): IsoDate {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + months;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

/** The days of a month in weeks of 7, padded with null before the 1st and after the last day. */
export function monthGrid(month: IsoDate): (IsoDate | null)[][] {
  const start = monthStart(month);
  const days: (IsoDate | null)[] = Array.from({ length: weekdayIndex(start) }, () => null);
  for (let day = start; day.slice(0, 7) === start.slice(0, 7); day = addDays(day, 1))
    days.push(day);
  while (days.length % 7 !== 0) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}
