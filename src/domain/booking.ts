import { z } from 'zod';

import type {
  BookingBreakdown,
  CreateBookingRequest,
  GuestDetails,
  QuoteLine,
  SearchRequest,
} from '../../supabase/functions/_shared/api';
import { guestsByCategory } from '../../supabase/functions/_shared/party';

import { paramsFromRequest, requestFromParams, withoutRegion } from './search';

export type { BookingBreakdown, CreateBookingRequest, GuestDetails, QuoteLine };

// ---------------------------------------------------------------------------
// /book?pitchType=…&arrival=…&departure=…&adults=…&children=…&equipment=…
// ---------------------------------------------------------------------------

export type BookingTarget = { pitchTypeId: string; stay: SearchRequest };

export function bookingTargetFromParams(params: Record<string, unknown>): BookingTarget | null {
  const raw = Array.isArray(params.pitchType) ? params.pitchType[0] : params.pitchType;
  const pitchTypeId = z.uuid().safeParse(raw);
  const stay = requestFromParams(params);
  return pitchTypeId.success && stay
    ? { pitchTypeId: pitchTypeId.data, stay: withoutRegion(stay) }
    : null;
}

export function bookingParams(target: BookingTarget): Record<string, string> {
  return { pitchType: target.pitchTypeId, ...paramsFromRequest(withoutRegion(target.stay)) };
}

// ---------------------------------------------------------------------------
// Step 2: the guest's details (the create-booking function checks them again)
// ---------------------------------------------------------------------------

export type GuestForm = {
  name: string;
  email: string;
  phone: string;
  country: string;
  locale: 'el' | 'en';
  vehiclePlate: string;
  arrivalEta: string;
  note: string;
};

export const EMPTY_GUEST: GuestForm = {
  name: '',
  email: '',
  phone: '',
  country: 'GR',
  locale: 'el',
  vehiclePlate: '',
  arrivalEta: '',
  note: '',
};

/** Countries offered in the form, most frequent guests first; others type their code. */
export const COUNTRIES = [
  'GR',
  'CY',
  'DE',
  'AT',
  'CH',
  'IT',
  'FR',
  'NL',
  'BE',
  'GB',
  'BG',
  'RO',
  'RS',
  'PL',
  'CZ',
  'HU',
  'SE',
  'DK',
  'ES',
  'US',
] as const;

const optional = (schema: z.ZodString) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(schema.optional());

export const guestFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().pipe(z.email().max(254)),
  phone: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().regex(/^\+[0-9][0-9 ]{5,23}$/)),
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/)),
  locale: z.enum(['el', 'en']),
  vehiclePlate: optional(z.string().max(20)),
  arrivalEta: optional(z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)),
  note: optional(z.string().max(1000)),
}) satisfies z.ZodType<GuestDetails, GuestForm>;

// ---------------------------------------------------------------------------
// What the steps show
// ---------------------------------------------------------------------------

/** Guests per category of the camping, e.g. [{id: adult, count: 2}], or null if an age fits none. */
export function partyByCategory(
  categories: { id: string; min_age: number; max_age: number | null }[],
  stay: Pick<SearchRequest, 'adults' | 'childAges'>,
): { id: string; count: number }[] | null {
  const counts = guestsByCategory(
    categories.map((c) => ({ id: c.id, minAge: c.min_age, maxAge: c.max_age })),
    { adults: stay.adults, childAges: stay.childAges },
  );
  if (!counts) return null;
  return categories.flatMap((c) => (counts[c.id] ? [{ id: c.id, count: counts[c.id]! }] : []));
}

export type LineLabel = {
  kind: QuoteLine['kind'];
  id: string;
  quantity: number;
  nights: number | null;
};

/** What a breakdown line covers: the item, how many, and over how many nights (null: once per stay). */
export function lineLabel(line: QuoteLine, nights: number): LineLabel {
  return {
    kind: line.kind,
    id: line.id,
    quantity: line.quantity,
    nights: line.per === 'night' ? nights : null,
  };
}
