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
    // Runs even when a date failed above; those errors are already reported.
    if (!isIsoDate(s.arrival) || !isIsoDate(s.departure)) return true;
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

const phone = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().regex(/^\+[0-9][0-9 ]{5,23}$/));

const guestDetails = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone,
  country: z.string().regex(/^[A-Z]{2}$/),
  locale: z.enum(['el', 'en']),
  vehiclePlate: z.string().trim().min(1).max(20).optional(),
  arrivalEta: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  note: z.string().trim().min(1).max(1000).optional(),
});

export const createBookingRequestSchema = stayQuery
  .extend({
    pitchTypeId: z.uuid(),
    extras: z.record(z.uuid(), z.int().min(0).max(20)).default({}),
    guest: guestDetails,
    acceptTerms: z.literal(true),
  })
  .refine(stayLength.check, stayLength.params);
export type CreateBookingInput = z.output<typeof createBookingRequestSchema>;
