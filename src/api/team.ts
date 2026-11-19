import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PartnerRole } from '@/domain/roles';
import { getSupabase } from '@/lib/supabase';

export const teamKey = (partnerId: string) => ['team', partnerId] as const;

/** A partner's members (with name and email) and invites, for its owners and admins. */
export function useTeam(partnerId: string | undefined) {
  return useQuery({
    queryKey: teamKey(partnerId ?? ''),
    queryFn: partnerId
      ? async () => {
          const supabase = getSupabase();
          const [members, invites] = await Promise.all([
            supabase.rpc('partner_team', { p_partner_id: partnerId }),
            supabase
              .from('partner_invites')
              .select('id, email, role, expires_at, accepted_at, created_at')
              .eq('partner_id', partnerId)
              .order('created_at', { ascending: false }),
          ]);
          if (members.error) throw members.error;
          if (invites.error) throw invites.error;
          return { members: members.data, invites: invites.data };
        }
      : skipToken,
  });
}

export type Team = NonNullable<ReturnType<typeof useTeam>['data']>;
export type TeamMember = Team['members'][number];
export type TeamInvite = Team['invites'][number];

type Change =
  | { kind: 'role'; userId: string; role: PartnerRole }
  | { kind: 'remove'; userId: string }
  | { kind: 'revoke'; inviteId: string };

/** Changes a member's role, removes a member or revokes a pending invite. */
export function useTeamChange(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: Change) => {
      const supabase = getSupabase();
      const { error } =
        change.kind === 'role'
          ? await supabase.rpc('set_partner_member_role', {
              p_partner_id: partnerId,
              p_user_id: change.userId,
              p_role: change.role,
            })
          : change.kind === 'remove'
            ? await supabase.rpc('remove_partner_member', {
                p_partner_id: partnerId,
                p_user_id: change.userId,
              })
            : await supabase.rpc('revoke_partner_invite', { p_invite_id: change.inviteId });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKey(partnerId) }),
        // Someone removed from a team loses the partner area; their roles may change.
        queryClient.invalidateQueries({ queryKey: ['my-access'] }),
      ]),
  });
}
