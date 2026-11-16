import { skipToken, useQuery } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

import { useAuth } from './auth';
import type { Database } from './database.types';

export type PartnerRole = Database['public']['Enums']['partner_role'];

export type MyAccess = {
  isAdmin: boolean;
  memberships: { partnerId: string; partnerName: string; role: PartnerRole }[];
};

async function fetchMyAccess(userId: string): Promise<MyAccess> {
  const supabase = getSupabase();
  const [profile, members] = await Promise.all([
    supabase.from('profiles').select('is_platform_admin').eq('id', userId).maybeSingle(),
    supabase
      .from('partner_members')
      .select('partner_id, role, partners(name)')
      .eq('user_id', userId),
  ]);
  if (profile.error) throw profile.error;
  if (members.error) throw members.error;
  return {
    isAdmin: profile.data?.is_platform_admin ?? false,
    memberships: members.data.map((m) => ({
      partnerId: m.partner_id,
      partnerName: m.partners?.name ?? '',
      role: m.role,
    })),
  };
}

/** The signed-in user's roles: platform admin and partner memberships. */
export function useMyAccess() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-access', userId],
    queryFn: userId ? () => fetchMyAccess(userId) : skipToken,
  });
}

export function canEnter(area: 'partner' | 'admin', access: MyAccess): boolean {
  return area === 'admin' ? access.isAdmin : access.memberships.length > 0;
}
