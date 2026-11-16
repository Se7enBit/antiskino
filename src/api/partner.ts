import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

import { useMyAccess } from './access';
import type { Database } from './database.types';

type CampingUpdate = Database['public']['Tables']['campings']['Update'];

/**
 * Campings of the partners the user belongs to. (Live campings of other
 * partners are publicly readable, so the query filters by membership.)
 */
export function useMyCampings() {
  const access = useMyAccess();
  const partnerIds = access.data?.memberships.map((m) => m.partnerId);
  return useQuery({
    queryKey: ['partner', 'campings', partnerIds],
    queryFn: partnerIds
      ? async () => {
          if (partnerIds.length === 0) return [];
          const { data, error } = await getSupabase()
            .from('campings')
            .select('id, name, slug, status, partner_id')
            .in('partner_id', partnerIds)
            .order('name');
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

export function useCamping(campingId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'camping', campingId],
    queryFn: campingId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('campings')
            .select('*')
            .eq('id', campingId)
            .single();
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

/** Saves the profile columns. Fails (instead of silently doing nothing) if RLS refuses. */
export function useUpdateCampingProfile(campingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: CampingUpdate) => {
      const { error } = await getSupabase()
        .from('campings')
        .update(update)
        .eq('id', campingId)
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner'] }),
  });
}
