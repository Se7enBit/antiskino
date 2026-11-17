// Validation of the search and quote request bodies.
import { isIsoDate, nightsBetween } from './dates.ts';
import { z } from './deps.ts';
import { MAX_ADULTS, MAX_CHILDREN } from './party.ts';

export const MAX_NIGHTS = 30;

const isoDate = z.string().refine(isIsoDate, 'Expected a date as YYYY-MM-DD');

const stayQuery = z.object({
  arrival: isoDate,
  departure: isoDate,
  adults: z.int().min(1).max(MAX_ADULTS),
  childAges: z.array(z.int().min(0).max(17)).max(MAX_CHILDREN).default([]),
  equipment: z.enum(['tent', 'caravan', 'camper']),
});

const stayLength = {
  check: (s: { arrival: string; departure: string }) => {
    const nights = nightsBetween(s.arrival, s.departure);
    return nights >= 1 && nights <= MAX_NIGHTS;
  },
  params: { path: ['departure'], message: `A stay is 1 to ${MAX_NIGHTS} nights` },
};

export const searchRequestSchema = stayQuery
  .extend({ region: z.string().trim().min(1).max(80).optional(), campingId: z.uuid().optional() })
  .refine(stayLength.check, stayLength.params);
export type SearchInput = z.output<typeof searchRequestSchema>;

export const quoteRequestSchema = stayQuery
  .extend({
    pitchTypeId: z.uuid(),
    extras: z.record(z.uuid(), z.int().min(0).max(20)).default({}),
  })
  .refine(stayLength.check, stayLength.params);
export type QuoteInput = z.output<typeof quoteRequestSchema>;
