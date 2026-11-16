import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CampingStatus } from '@/domain/roles';
import { getSupabase } from '@/lib/supabase';

import type { Database } from './database.types';

type PartnerInsert = Database['public']['Tables']['partners']['Insert'];

const keys = {
  partners: ['admin', 'partners'] as const,
  partner: (id: string) => ['admin', 'partner', id] as const,
  team: (id: string) => ['admin', 'team', id] as const,
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

/** Team members (with their profile names) and invites of a partner. */
export function usePartnerTeam(partnerId: string | undefined) {
  return useQuery({
    queryKey: keys.team(partnerId ?? ''),
    queryFn: partnerId
      ? async () => {
          const supabase = getSupabase();
          const [members, invites] = await Promise.all([
            supabase
              .from('partner_members')
              .select('user_id, role, created_at')
              .eq('partner_id', partnerId)
              .order('created_at'),
            supabase
              .from('partner_invites')
              .select('id, email, role, expires_at, accepted_at, created_at')
              .eq('partner_id', partnerId)
              .order('created_at', { ascending: false }),
          ]);
          if (members.error) throw members.error;
          if (invites.error) throw invites.error;
          const userIds = members.data.map((m) => m.user_id);
          const profiles = userIds.length
            ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
            : { data: [], error: null };
          if (profiles.error) throw profiles.error;
          const names = new Map(profiles.data.map((p) => [p.id, p.full_name]));
          return {
            members: members.data.map((m) => ({ ...m, full_name: names.get(m.user_id) ?? null })),
            invites: invites.data,
          };
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
