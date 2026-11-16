import { useMutation, useQueryClient } from '@tanstack/react-query';

import { acceptInviteResultSchema } from '@/domain/invites';
import type { PartnerRole } from '@/domain/roles';
import { getSupabase } from '@/lib/supabase';

/** Creates a 7-day invite and returns its one-time token (never stored by us). */
export function useCreateInvite(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: PartnerRole }) => {
      const { data, error } = await getSupabase().rpc('create_partner_invite', {
        p_partner_id: partnerId,
        p_email: email,
        p_role: role,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'team', partnerId] }),
  });
}

/** Accepts an invite for the signed-in user; refreshes their roles when it works. */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await getSupabase().rpc('accept_partner_invite', { p_token: token });
      if (error) throw error;
      return acceptInviteResultSchema.parse(data);
    },
    onSuccess: (result) => {
      if (result.status === 'accepted')
        return queryClient.invalidateQueries({ queryKey: ['my-access'] });
    },
  });
}
