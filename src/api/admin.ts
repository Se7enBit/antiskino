import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { GuestContact } from '@/domain/booking';
import type { BookingRange } from '@/domain/partnerBookings';
import type { CampingStatus } from '@/domain/roles';
import { getSupabase } from '@/lib/supabase';

import type { Database } from './database.types';

type PartnerInsert = Database['public']['Tables']['partners']['Insert'];

const keys = {
  partners: ['admin', 'partners'] as const,
  partner: (id: string) => ['admin', 'partner', id] as const,
};

/** Every partner with its campings (admins only; RLS returns nothing to others). */
export function usePartners() {
  return useQuery({
    queryKey: keys.partners,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('partners')
        .select('id, name, status, commission_bps, campings(id, name, slug, status)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function usePartner(partnerId: string | undefined) {
  return useQuery({
    queryKey: keys.partner(partnerId ?? ''),
    queryFn: partnerId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('partners')
            .select(
              'id, name, legal_name, vat_number, billing_email, commission_bps, status, campings(id, name, slug, status, region)',
            )
            .eq('id', partnerId)
            .maybeSingle();
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partner: PartnerInsert) => {
      const { data, error } = await getSupabase()
        .from('partners')
        .insert(partner)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.partners }),
  });
}

export function useUpdateCommission(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commissionBps: number | null) => {
      const { error } = await getSupabase()
        .from('partners')
        .update({ commission_bps: commissionBps })
        .eq('id', partnerId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.partner(partnerId) }),
        queryClient.invalidateQueries({ queryKey: keys.partners }),
      ]),
  });
}

export function useCreateCamping(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (camping: { name: string; slug: string; region: string | null }) => {
      const { error } = await getSupabase()
        .from('campings')
        .insert({ ...camping, partner_id: partnerId });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.partner(partnerId) }),
        queryClient.invalidateQueries({ queryKey: keys.partners }),
      ]),
  });
}

export function useSetCampingStatus(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campingId, status }: { campingId: string; status: CampingStatus }) => {
      const { error } = await getSupabase().rpc('set_camping_status', {
        p_camping_id: campingId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.partner(partnerId) }),
        queryClient.invalidateQueries({ queryKey: keys.partners }),
      ]),
  });
}

/** How many bookings the admin list loads at most (newest arrivals first). */
export const ADMIN_BOOKINGS_LIMIT = 500;

/** Every camping's bookings whose stay overlaps the range, newest arrival first (SPEC F12, read-only). */
export function useAdminBookings(range: BookingRange) {
  return useQuery({
    queryKey: ['admin', 'bookings', range.from, range.to],
    queryFn: async () => {
      let query = getSupabase()
        .from('bookings')
        .select(
          'id, ref, status, arrival, departure, nights, party_size, guest_name, total_cents, commission_cents, created_at, camping:campings(name)',
        )
        .gte('departure', range.from);
      if (range.to) query = query.lte('arrival', range.to);
      const { data, error } = await query
        .order('arrival', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(ADMIN_BOOKINGS_LIMIT);
      if (error) throw error;
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export type AdminBooking = NonNullable<ReturnType<typeof useAdminBookings>['data']>[number];

/** Corrects the guest's contact details on a booking (admins only; admin_update_booking_guest). */
export function useUpdateBookingGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, guest }: { bookingId: string; guest: GuestContact }) => {
      const { error } = await getSupabase().rpc('admin_update_booking_guest', {
        p_booking_id: bookingId,
        p_name: guest.name,
        p_email: guest.email,
        p_phone: guest.phone,
        p_country: guest.country,
        p_locale: guest.locale,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['partner'] }),
        queryClient.invalidateQueries({ queryKey: ['admin'] }),
      ]),
  });
}
