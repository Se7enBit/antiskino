import type { Language } from '@/i18n/languages';

import { TIME_ZONE } from './dates';

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
