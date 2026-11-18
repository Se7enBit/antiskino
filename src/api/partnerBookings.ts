import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';

import type { BookingRange, ReceptionAction } from '@/domain/partnerBookings';
import { getSupabase } from '@/lib/supabase';

import { breakdownSchema } from './guestBooking';

export { PAST_DAYS } from '@/domain/partnerBookings';

/** A camping's bookings whose stay overlaps the range, by arrival (partner members and admins). */
export function useCampingBookings(campingId: string | undefined, range: BookingRange) {
  return useQuery({
    queryKey: ['partner', 'bookings', campingId, range.from, range.to],
    queryFn: campingId
      ? async () => {
          let query = getSupabase()
            .from('bookings')
            .select(
              'id, ref, status, arrival, departure, nights, equipment, party_size, total_cents, guest_name, guest_email, guest_phone, guest_country, guest_note, arrival_eta, vehicle_plate, request_expires_at, cancel_reason, assigned_pitch, created_at, pitch_type:pitch_types(name)',
            )
            .eq('camping_id', campingId)
            .gte('departure', range.from);
          if (range.to) query = query.lte('arrival', range.to);
          const { data, error } = await query.order('arrival').order('created_at');
          if (error) throw error;
          return data;
        }
      : skipToken,
    // Keep the list on screen while another range loads.
    placeholderData: keepPreviousData,
    // Realtime (useCampingBookingsLive) refreshes on changes; this catches anything it missed.
    refetchInterval: 5 * 60_000,
  });
}

export type CampingBooking = NonNullable<ReturnType<typeof useCampingBookings>['data']>[number];

export type BookingAction = ReceptionAction;

/** Accept or decline a request, check in, mark a no-show, or cancel with a reason (partner_booking_action). */
export function usePartnerBookingAction() {
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

const counts = z.record(z.string(), z.int());

/** One booking with everything reception needs, by reference; null when not the team's. */
export function usePartnerBooking(ref: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'booking', ref],
    queryFn: ref
      ? async () => {
          const { data, error } = await getSupabase()
            .from('bookings')
            .select(
              'id, ref, camping_id, status, arrival, departure, nights, equipment, party, party_size, extras, total_cents, price_breakdown, payment_mode, cancellation_policy, commission_cents, guest_name, guest_email, guest_phone, guest_country, locale, guest_note, arrival_eta, vehicle_plate, request_expires_at, cancel_reason, assigned_pitch, internal_note, created_at, pitch_type:pitch_types(name), events:booking_events(id, at, actor_kind, from_status, to_status, note)',
            )
            .eq('ref', ref.trim().toUpperCase())
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return {
            ...data,
            party: counts.catch({}).parse(data.party),
            extras: counts.catch({}).parse(data.extras),
            // Older or hand-made rows may lack a full snapshot: show the total only.
            price_breakdown: breakdownSchema.safeParse(data.price_breakdown).data ?? null,
            events: [...data.events].sort((a, b) => a.id - b.id),
          };
        }
      : skipToken,
  });
}

export type PartnerBooking = NonNullable<ReturnType<typeof usePartnerBooking>['data']>;

/** Sets the assigned pitch and the internal note; empty text clears them. */
export function useUpdateBookingDesk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      assignedPitch,
      internalNote,
    }: {
      bookingId: string;
      assignedPitch: string;
      internalNote: string;
    }) => {
      const { error } = await getSupabase().rpc('update_booking_desk', {
        p_booking_id: bookingId,
        p_assigned_pitch: assignedPitch,
        p_internal_note: internalNote,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner'] }),
  });
}
