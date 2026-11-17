import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type {
  CreateBookingRequest,
  CreateBookingResponse,
  QuoteRequest,
  QuoteResponse,
} from '../../supabase/functions/_shared/api';
import { getSupabase } from '@/lib/supabase';

import { invokeFunction } from './functions';

export type { CreateBookingResponse, QuoteResponse };

async function fetchBookingContext(pitchTypeId: string) {
  const { data, error } = await getSupabase()
    .from('pitch_types')
    // One literal string, so supabase-js infers the row type.
    .select(
      'id, name, active, camping:campings(id, slug, name, status, confirmation_mode, request_expiry_hours, payment_mode, cancellation_policy, extras(id, name, unit, max_qty, active, sort), guest_categories(id, name, min_age, max_age, sort), fees(id, name, unit))',
    )
    .eq('id', pitchTypeId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.active || !data.camping) return null;
  const { camping } = data;
  return {
    pitchType: { id: data.id, name: data.name },
    camping: {
      id: camping.id,
      slug: camping.slug,
      name: camping.name,
      status: camping.status,
      confirmationMode: camping.confirmation_mode,
      requestExpiryHours: camping.request_expiry_hours,
      paymentMode: camping.payment_mode,
      cancellationPolicy: camping.cancellation_policy,
    },
    // Partner members can read hidden extras too.
    extras: camping.extras.filter((e) => e.active).sort((a, b) => a.sort - b.sort),
    guestCategories: [...camping.guest_categories].sort(
      (a, b) => a.sort - b.sort || b.min_age - a.min_age,
    ),
    fees: camping.fees,
  };
}

export type BookingContext = NonNullable<Awaited<ReturnType<typeof fetchBookingContext>>>;

/** The pitch type, its camping's terms, extras, guest categories and fees, for the booking flow. */
export function useBookingContext(pitchTypeId: string | undefined) {
  return useQuery({
    queryKey: ['public', 'booking-context', pitchTypeId],
    queryFn: pitchTypeId ? () => fetchBookingContext(pitchTypeId) : skipToken,
  });
}

const quoteLineSchema = z.object({
  kind: z.enum(['pitch', 'guest', 'extra', 'fee']),
  id: z.string(),
  quantity: z.int(),
  per: z.enum(['night', 'stay']),
  totalCents: z.int().nonnegative(),
});

export const quoteSchema = z.object({
  nights: z.array(z.object({ night: z.string(), seasonId: z.string(), totalCents: z.int() })),
  lines: z.array(quoteLineSchema),
  totalCents: z.int().nonnegative(),
});

const unavailableReason = z.enum(['not_found', 'unavailable', 'party', 'no_price', 'extras']);

const quoteResponseSchema: z.ZodType<QuoteResponse> = z.union([
  z.object({ available: z.literal(true), quote: quoteSchema, offeredExtras: z.array(z.string()) }),
  z.object({ available: z.literal(false), reason: unavailableReason }),
]);

/** The price of the stay with the chosen extras (the quote edge function). */
export function useQuote(request: QuoteRequest | null) {
  return useQuery({
    queryKey: ['public', 'quote', request],
    queryFn: request ? () => invokeFunction('quote', request, quoteResponseSchema) : skipToken,
    // Keep the last price on screen while a new quantity is priced.
    placeholderData: (previous) => previous,
  });
}

const createBookingResponseSchema: z.ZodType<CreateBookingResponse> = z.union([
  z.object({
    booked: z.literal(true),
    ref: z.string(),
    status: z.enum(['confirmed', 'requested']),
    requestExpiresAt: z.string().nullable(),
    manageToken: z.string(),
    totalCents: z.int().nonnegative(),
  }),
  z.object({ booked: z.literal(false), reason: unavailableReason }),
]);

/** Books the stay (the create-booking edge function). */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateBookingRequest) =>
      invokeFunction('create-booking', request, createBookingResponseSchema),
    // Availability changed: search results and quotes are stale.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public'] }),
  });
}

/** A signed-in user's saved details, to prefill the booking form. */
export function useMyDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['me', 'details', userId],
    queryFn: userId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('profiles')
            .select('full_name, phone, country, locale')
            .eq('id', userId)
            .maybeSingle();
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}
