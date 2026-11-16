import { z } from 'zod';

import { isIsoDate } from '../../supabase/functions/_shared/dates';

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
