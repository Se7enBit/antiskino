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
