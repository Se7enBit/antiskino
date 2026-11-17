import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

import { quoteSchema } from './booking';

const STATUSES = [
  'held',
  'requested',
  'confirmed',
  'declined',
  'expired',
  'cancelled',
  'checked_in',
  'completed',
  'no_show',
] as const;
export type BookingStatus = (typeof STATUSES)[number];

const names = z.record(z.string(), z.unknown());

/** The price snapshot of a booking: the quote and, since M4, the item names at booking time. */
export const breakdownSchema = quoteSchema.extend({
  names: z.object({ pitch: z.unknown(), guest: names, extra: names, fee: names }).optional(),
});

export const guestBookingObject = z.object({
  ref: z.string(),
  status: z.enum(STATUSES),
  can_cancel: z.boolean(),
  arrival: z.string(),
  departure: z.string(),
  nights: z.int(),
  equipment: z.enum(['tent', 'caravan', 'camper']),
  party: z.record(z.string(), z.int()),
  extras: z.record(z.string(), z.int()),
  total_cents: z.int(),
  price_breakdown: breakdownSchema,
  payment_mode: z.enum(['on_site', 'deposit', 'full']),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']),
  request_expires_at: z.string().nullable(),
  cancel_reason: z.string().nullable(),
  created_at: z.string(),
  guest: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    country: z.string(),
    locale: z.enum(['el', 'en']),
    vehicle_plate: z.string().nullable(),
    arrival_eta: z.string().nullable(),
    note: z.string().nullable(),
  }),
  camping: z.object({
    name: z.string(),
    slug: z.string(),
    address: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    check_in_from: z.string().nullable(),
    check_out_until: z.string().nullable(),
  }),
  pitch_type: z.object({ id: z.string(), name: z.unknown() }),
  names: z.object({ guest: names, extra: names, fee: names }),
});

const guestBookingSchema = guestBookingObject.nullable();

export type GuestBooking = NonNullable<z.output<typeof guestBookingSchema>>;

const key = (ref: string | undefined) => ['guest-booking', ref] as const;

/** The booking behind a manage link (/m?ref=…&t=…), or null for a wrong ref or token. */
export function useGuestBooking(ref: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: key(ref),
    queryFn:
      ref && token
        ? async () => {
            const { data, error } = await getSupabase().rpc('guest_booking', {
              p_ref: ref,
              p_token: token,
            });
            if (error) throw error;
            return guestBookingSchema.parse(data);
          }
        : skipToken,
  });
}

/** Cancels with the manage link (until the end of the arrival day). */
export function useGuestCancelBooking(ref: string, token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc('guest_cancel_booking', {
        p_ref: ref,
        p_token: token,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(ref) }),
  });
}
