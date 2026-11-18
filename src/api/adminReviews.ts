import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

/** How many reviews the moderation list loads. */
const LIMIT = 100;

/** The latest reviews of every camping, or only hidden ones (SPEC F12 Reviews). */
export function useAdminReviews(onlyHidden: boolean) {
  return useQuery({
    queryKey: ['admin', 'reviews', onlyHidden],
    queryFn: async () => {
      let query = getSupabase()
        .from('reviews')
        .select(
          'id, rating, body, author_name, author_country, stay_month, partner_reply, hidden, hidden_reason, created_at, camping:campings(name)',
        );
      if (onlyHidden) query = query.eq('hidden', true);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(LIMIT);
      if (error) throw error;
      return data;
    },
  });
}

export type AdminReview = NonNullable<ReturnType<typeof useAdminReviews>['data']>[number];

/** Hides a review with a reason, or shows it again. */
export function useSetReviewHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      hidden,
      reason,
    }: {
      reviewId: string;
      hidden: boolean;
      reason: string;
    }) => {
      const { error } = await getSupabase().rpc('set_review_hidden', {
        p_review_id: reviewId,
        p_hidden: hidden,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['public', 'reviews'] }),
      ]),
  });
}
