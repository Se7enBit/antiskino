import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays, todayInAthens } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase';

/** How far back the list goes (past and cancelled stays). */
export const PAST_DAYS = 60;

/** A camping's bookings from 60 days ago on, by arrival (partner members and admins). */
export function useCampingBookings(campingId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'bookings', campingId],
    queryFn: campingId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('bookings')
            .select(
              'id, ref, status, arrival, departure, nights, equipment, party_size, total_cents, guest_name, guest_email, guest_phone, guest_country, guest_note, arrival_eta, vehicle_plate, request_expires_at, cancel_reason, created_at, pitch_type:pitch_types(name)',
            )
            .eq('camping_id', campingId)
            .gte('departure', addDays(todayInAthens(), -PAST_DAYS))
            .order('arrival')
            .order('created_at');
          if (error) throw error;
          return data;
        }
      : skipToken,
    // Requests can arrive any time; refresh the list now and then (realtime comes in M5).
    refetchInterval: 60_000,
  });
}

export type CampingBooking = NonNullable<ReturnType<typeof useCampingBookings>['data']>[number];

export type BookingAction = 'accept' | 'decline' | 'cancel';

/** Accept or decline a request, or cancel with a reason (partner_booking_action). */
export function usePartnerBookingAction(campingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      action,
      reason,
    }: {
      bookingId: string;
      action: BookingAction;
      reason?: string;
    }) => {
      const { error } = await getSupabase().rpc('partner_booking_action', {
        p_booking_id: bookingId,
        p_action: action,
        p_note: reason ?? '',
      });
      if (error) throw error;
    },
    // Inventory changes too (declines and cancellations free nights).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner'] }),
  });
}
