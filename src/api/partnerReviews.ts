import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

/** All of a camping's reviews for its team, hidden ones too, newest first (SPEC F11 Reviews). */
export function useTeamReviews(campingId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'reviews', campingId],
    queryFn: campingId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('reviews')
            .select(
              'id, rating, body, author_name, author_country, stay_month, partner_reply, partner_replied_at, hidden, hidden_reason, created_at, booking:bookings(ref, guest_name)',
            )
            .eq('camping_id', campingId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

export type TeamReview = NonNullable<ReturnType<typeof useTeamReviews>['data']>[number];

/** Posts, edits or (with empty text) removes the camping's public reply. */
export function useReplyToReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const { error } = await getSupabase().rpc('reply_to_review', {
        p_review_id: reviewId,
        p_reply: reply,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['partner', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['public', 'reviews'] }),
      ]),
  });
}
