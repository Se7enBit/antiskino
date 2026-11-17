import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

import { breakdownSchema, guestBookingObject, type BookingStatus } from './guestBooking';

export type MyBookingItem = {
  id: string;
  ref: string;
  status: BookingStatus;
  arrival: string;
  departure: string;
  totalCents: number;
  campingName: string | null;
  /** jsonb {"el", "en"} */
  pitchName: unknown;
};

/**
 * The signed-in user's bookings. Claims the bookings made with their verified
 * email first (SPEC F7), so bookings made as a guest show up too.
 */
export function useMyBookings(userId: string | undefined) {
  return useQuery({
    queryKey: ['me', 'bookings', userId],
    queryFn: userId
      ? async () => {
          const supabase = getSupabase();
          const claim = await supabase.rpc('claim_bookings');
          if (claim.error) throw claim.error;
          const { data, error } = await supabase
            .from('bookings')
            .select(
              'id, ref, status, arrival, departure, total_cents, price_breakdown, camping:campings(name), pitch_type:pitch_types(name)',
            )
            // Partner members can read their campings' bookings too: only mine here.
            .eq('user_id', userId)
            .order('arrival');
          if (error) throw error;
          return data.map((b): MyBookingItem => {
            const snapshot = breakdownSchema.safeParse(b.price_breakdown);
            return {
              id: b.id,
              ref: b.ref,
              status: b.status,
              arrival: b.arrival,
              departure: b.departure,
              totalCents: b.total_cents,
              // RLS hides campings that are no longer live, whatever the inferred type says;
              // a hidden pitch type still shows by its booking-time name.
              campingName: (b.camping as { name: string } | null)?.name ?? null,
              pitchName:
                b.pitch_type?.name ??
                (snapshot.success ? snapshot.data.names?.pitch : null) ??
                null,
            };
          });
        }
      : skipToken,
  });
}

const myBookingSchema = guestBookingObject.extend({ id: z.string() }).nullable();
export type MyBooking = NonNullable<z.output<typeof myBookingSchema>>;

/** One of the user's bookings by reference, or null when it isn't theirs. */
export function useMyBooking(ref: string | undefined) {
  return useQuery({
    queryKey: ['me', 'booking', ref],
    queryFn: ref
      ? async () => {
          const { data, error } = await getSupabase().rpc('my_booking', { p_ref: ref });
          if (error) throw error;
          return myBookingSchema.parse(data);
        }
      : skipToken,
  });
}

export function useCancelMyBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await getSupabase().rpc('cancel_my_booking', { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}
