import type { Language } from '@/i18n/languages';

import { TIME_ZONE, type IsoDate } from './dates';

const LOCALES: Record<Language, string> = { el: 'el-GR', en: 'en-IE' };

/** A timestamp as a short date in Athens time, e.g. "23 Nov 2026" / "23 Νοε 2026". */
export function formatShortDate(timestamp: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

/** A night as a short weekday plus day/month for grid headers: { weekday: "Πέμ", day: "01/07" }. */
export function formatNight(night: IsoDate, language: Language): { weekday: string; day: string } {
  const [year, month, day] = night.split('-');
  // Formatting only: the calendar date at UTC midnight has the same weekday everywhere.
  const weekday = new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(`${year}-${month}-${day}T00:00:00Z`));
  return { weekday, day: `${day}/${month}` };
}

/** "2027-07-01" → "July 2027" / "Ιούλιος 2027". */
export function formatMonth(month: IsoDate, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));
}

/** A timestamp as date and time in Athens: "1 Jul 2027, 14:00" / "1 Ιουλ 2027, 14:00". */
export function formatDateTime(timestamp: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp));
}
