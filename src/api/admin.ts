import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
