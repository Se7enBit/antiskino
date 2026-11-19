import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

import { useAuth } from './auth';

/** The team emails a partner member can turn off (pushes are not affected). */
export const MUTABLE_EMAILS = [
  'booking_confirmed',
  'request_received',
  'booking_cancelled',
] as const;
export type MutableEmail = (typeof MUTABLE_EMAILS)[number];

const isMutable = (kind: string): kind is MutableEmail =>
  (MUTABLE_EMAILS as readonly string[]).includes(kind);

const key = (userId: string | undefined) => ['me', 'mutedEmails', userId] as const;

/** The email kinds the signed-in member turned off. */
export function useMutedEmails() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: key(userId),
    queryFn: userId
      ? async (): Promise<MutableEmail[]> => {
          const { data, error } = await getSupabase()
            .from('profiles')
            .select('muted_emails')
            .eq('id', userId)
            .maybeSingle();
          if (error) throw error;
          return (data?.muted_emails ?? []).filter(isMutable);
        }
      : skipToken,
  });
}

/** Saves the whole list of turned-off kinds. */
export function useSetMutedEmails() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (muted: MutableEmail[]) => {
      if (!userId) throw new Error('not signed in');
      const { error } = await getSupabase()
        .from('profiles')
        .update({ muted_emails: muted })
        .eq('id', userId);
      if (error) throw error;
      return muted;
    },
    onSuccess: (muted) => queryClient.setQueryData(key(userId), muted),
  });
}
