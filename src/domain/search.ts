import { z } from 'zod';

import type { Equipment, SearchRequest } from '../../supabase/functions/_shared/api';
import { MAX_ADULTS, MAX_CHILDREN } from '../../supabase/functions/_shared/party';
import { isIsoDate, isoDateSchema, nightsBetween, type IsoDate } from '@/lib/dates';

export type { Equipment, SearchRequest };
export { MAX_ADULTS, MAX_CHILDREN };

export const EQUIPMENT = ['tent', 'caravan', 'camper'] as const satisfies readonly Equipment[];
export const MAX_NIGHTS = 30;
export const MAX_CHILD_AGE = 17;
/** The age a newly added child starts at in the guest picker. */
export const DEFAULT_CHILD_AGE = 6;

/** The search form: dates may still be missing. */
export type SearchQuery = {
  arrival: IsoDate | null;
  departure: IsoDate | null;
  adults: number;
  childAges: number[];
  equipment: Equipment;
  region: string | null;
};

export const DEFAULT_QUERY: SearchQuery = {
  arrival: null,
  departure: null,
  adults: 2,
  childAges: [],
  equipment: 'tent',
  region: null,
};

export type StayProblem = 'noDates' | 'past' | 'tooLong';

/** Why the form's dates can't be searched yet, or null. */
export function stayProblem(query: SearchQuery, today: IsoDate): StayProblem | null {
  if (!query.arrival || !query.departure) return 'noDates';
  if (query.arrival < today) return 'past';
  const nights = nightsBetween(query.arrival, query.departure);
  if (nights < 1) return 'noDates';
  return nights > MAX_NIGHTS ? 'tooLong' : null;
}

/** The form as a request for the search function, or null while it is incomplete. */
export function toRequest(query: SearchQuery): SearchRequest | null {
  if (!query.arrival || !query.departure) return null;
  return {
    arrival: query.arrival,
    departure: query.departure,
    adults: query.adults,
    childAges: query.childAges,
    equipment: query.equipment,
    ...(query.region ? { region: query.region } : {}),
  };
}

// ---------------------------------------------------------------------------
// URL parameters of /search: ?arrival=…&departure=…&adults=2&children=4,7&equipment=tent&region=…
// ---------------------------------------------------------------------------

const count = (min: number, max: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.int().min(min).max(max));

const childAgesParam = z
  .string()
  .default('')
  .transform((value) => (value === '' ? [] : value.split(',')))
  .pipe(z.array(count(0, MAX_CHILD_AGE)).max(MAX_CHILDREN));

const searchParamsSchema = z
  .object({
    arrival: isoDateSchema,
    departure: isoDateSchema,
    adults: count(1, MAX_ADULTS),
    children: childAgesParam,
    equipment: z.enum(EQUIPMENT),
    region: z.string().trim().min(1).max(80).optional(),
  })
  .refine((p) => {
    // Runs even when a date failed above; those errors are already reported.
    if (!isIsoDate(p.arrival) || !isIsoDate(p.departure)) return true;
    const nights = nightsBetween(p.arrival, p.departure);
    return nights >= 1 && nights <= MAX_NIGHTS;
  });

/** Route params → a search request, or null when they don't describe one. */
export function requestFromParams(params: Record<string, unknown>): SearchRequest | null {
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = searchParamsSchema.safeParse(single);
  if (!parsed.success) return null;
  const { children, region, ...rest } = parsed.data;
  return { ...rest, childAges: children, ...(region ? { region } : {}) };
}

export function paramsFromRequest(request: SearchRequest): Record<string, string> {
  return {
    arrival: request.arrival,
    departure: request.departure,
    adults: String(request.adults),
    ...(request.childAges.length ? { children: request.childAges.join(',') } : {}),
    equipment: request.equipment,
    ...(request.region ? { region: request.region } : {}),
  };
}

/** The form state for a request (e.g. after opening a shared results link). */
export function queryFromRequest(request: SearchRequest): SearchQuery {
  return {
    arrival: request.arrival,
    departure: request.departure,
    adults: request.adults,
    childAges: request.childAges,
    equipment: request.equipment,
    region: request.region ?? null,
  };
}

/** Distinct regions of the live campings, sorted; the region filter shows only with two or more. */
export function regionsOf(campings: { region: string | null }[]): string[] {
  return [...new Set(campings.flatMap((c) => (c.region ? [c.region] : [])))].sort((a, b) =>
    a.localeCompare(b, 'el'),
  );
}
