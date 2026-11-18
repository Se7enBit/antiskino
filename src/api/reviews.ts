import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReviewInput } from '@/domain/reviews';
import { getSupabase } from '@/lib/supabase';

/** How many reviews the camping page shows. */
const PAGE = 30;

/** A camping's visible reviews, newest first, and its rating (SPEC F9). */
export function useCampingReviews(campingId: string | undefined) {
  return useQuery({
    queryKey: ['public', 'reviews', campingId],
    queryFn: campingId
      ? async () => {
          const supabase = getSupabase();
          const [reviews, rating] = await Promise.all([
            supabase
              .from('reviews')
              .select(
                'id, rating, body, author_name, author_country, stay_month, partner_reply, created_at',
              )
              .eq('camping_id', campingId)
              // The camping's team and admins can read hidden ones too.
              .eq('hidden', false)
              .order('created_at', { ascending: false })
              .limit(PAGE),
            supabase
              .from('camping_ratings')
              .select('review_count, rating_avg')
              .eq('camping_id', campingId)
              .maybeSingle(),
          ]);
          if (reviews.error) throw reviews.error;
          if (rating.error) throw rating.error;
          return {
            reviews: reviews.data,
            rating:
              rating.data?.review_count && rating.data.rating_avg !== null
                ? { average: Number(rating.data.rating_avg), count: rating.data.review_count }
                : null,
          };
        }
      : skipToken,
  });
}

export type CampingReview = NonNullable<
  ReturnType<typeof useCampingReviews>['data']
>['reviews'][number];

/** The signed-in guest reviews one of their completed stays. */
export function useSubmitMyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, rating, body }: ReviewInput & { bookingId: string }) => {
      const { error } = await getSupabase().rpc('submit_my_review', {
        p_booking_id: bookingId,
        p_rating: rating,
        p_body: body,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        queryClient.invalidateQueries({ queryKey: ['public', 'reviews'] }),
      ]),
  });
}

/** A guest reviews with the manage link. */
export function useGuestSubmitReview(ref: string, token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rating, body }: ReviewInput) => {
      const { error } = await getSupabase().rpc('guest_submit_review', {
        p_ref: ref,
        p_token: token,
        p_rating: rating,
        p_body: body,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guest-booking', ref] }),
        queryClient.invalidateQueries({ queryKey: ['public', 'reviews'] }),
      ]),
  });
}
