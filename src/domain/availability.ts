import { z } from 'zod';

import { addDays, daysBetween, type IsoDate } from '@/lib/dates';

import { dateInput, wholeNumber } from './formFields';

/** Nights shown at once in the partner grid. */
export const WINDOW_NIGHTS = 14;
/** set_allotment() / set_closed() take at most this many nights per call. */
export const MAX_RANGE_NIGHTS = 400;

/** `count` nights starting at `first`. */
export function nightWindow(first: IsoDate, count = WINDOW_NIGHTS): IsoDate[] {
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

export type InventoryNight = {
  pitch_type_id: string;
  night: IsoDate;
  allotment: number;
  booked: number;
  closed: boolean;
};

/** What one grid cell shows. */
export type Cell =
  { kind: 'none' } | { kind: 'open' | 'full' | 'closed'; booked: number; allotment: number };

export function cellFor(row: InventoryNight | undefined): Cell {
  if (!row) return { kind: 'none' };
  const kind = row.closed ? 'closed' : row.booked >= row.allotment ? 'full' : 'open';
  return { kind, booked: row.booked, allotment: row.allotment };
}

/** Rows keyed by pitch type and night, for quick cell lookups. */
export function indexInventory(rows: InventoryNight[]): Map<string, InventoryNight> {
  return new Map(rows.map((row) => [`${row.pitch_type_id}:${row.night}`, row]));
}
export const inventoryKey = (pitchTypeId: string, night: IsoDate) => `${pitchTypeId}:${night}`;

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const nightRange = z.object({ firstNight: dateInput, lastNight: dateInput });
type NightRange = z.output<typeof nightRange>;
const rangeChecks = <T extends NightRange>(schema: z.ZodType<T, unknown>) =>
  schema
    .refine((f) => f.lastNight >= f.firstNight, { path: ['lastNight'] })
    .refine((f) => daysBetween(f.firstNight, f.lastNight) < MAX_RANGE_NIGHTS, {
      path: ['lastNight'],
      params: { tooLong: true },
    });

export type AllotmentForm = {
  pitchTypeId: string;
  firstNight: string;
  lastNight: string;
  allotment: string;
};

export const allotmentFormSchema = rangeChecks(
  nightRange.extend({ pitchTypeId: z.string().min(1), allotment: wholeNumber(0, 1000) }),
).transform((f) => ({
  p_pitch_type_id: f.pitchTypeId,
  p_first_night: f.firstNight,
  p_last_night: f.lastNight,
  p_allotment: f.allotment,
}));
export type AllotmentArgs = z.output<typeof allotmentFormSchema>;

export type ClosingForm = { pitchTypeIds: string[]; firstNight: string; lastNight: string };

export const closingFormSchema = rangeChecks(
  nightRange.extend({ pitchTypeIds: z.array(z.string()).min(1) }),
);
export type ClosingValues = z.output<typeof closingFormSchema>;

export type AvailabilityError = 'pitchType' | 'firstNight' | 'lastNight' | 'tooLong' | 'allotment';

/** The message keys for a failed allotment or closing form. */
export function availabilityErrors(error: z.ZodError): Set<AvailabilityError> {
  const keys = new Set<AvailabilityError>();
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === 'pitchTypeId' || field === 'pitchTypeIds') keys.add('pitchType');
    else if (field === 'firstNight' || field === 'allotment') keys.add(field);
    else if (field === 'lastNight')
      keys.add(issue.code === 'custom' && issue.params?.tooLong === true ? 'tooLong' : 'lastNight');
  }
  return keys;
}
