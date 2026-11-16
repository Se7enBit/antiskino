/**
 * Calendar-date helpers for stays. Shared by the edge functions (Deno) and the
 * app (src/lib/dates.ts re-exports this file), so night math is identical on
 * both sides. Keep this module free of imports and platform APIs.
 *
 * Dates are `YYYY-MM-DD` strings in Europe/Athens. A stay covers the nights
 * from arrival (inclusive) to departure (exclusive).
 */

/** A calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

export const TIME_ZONE = 'Europe/Athens';

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01, or `null` if `value` is not a real `YYYY-MM-DD` date. */
function toDayNumber(value: string): number | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return time / DAY_MS;
}

function dayNumber(value: IsoDate): number {
  const day = toDayNumber(value);
  if (day === null) throw new RangeError(`Expected a date as YYYY-MM-DD, got "${value}"`);
  return day;
}

function fromDayNumber(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && toDayNumber(value) !== null;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) throw new RangeError(`Expected whole days, got ${days}`);
  return fromDayNumber(dayNumber(date) + days);
}

/** Calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** Number of nights in a stay. */
export function nightsBetween(arrival: IsoDate, departure: IsoDate): number {
  return daysBetween(arrival, departure);
}

/** Every night of a stay, arrival first; empty if departure is not after arrival. */
export function stayNights(arrival: IsoDate, departure: IsoDate): IsoDate[] {
  const first = dayNumber(arrival);
  const count = dayNumber(departure) - first;
  return Array.from({ length: Math.max(0, count) }, (_, i) => fromDayNumber(first + i));
}

/** Today's date in Europe/Athens. */
export function todayInAthens(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
