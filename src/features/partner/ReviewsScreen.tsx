import { StyleSheet, View } from 'react-native';

import { useReplyToReview, useTeamReviews } from '@/api/partnerReviews';
import { MIN_REVIEWS_FOR_RATING, visibleRating } from '@/domain/reviews';
import { useT } from '@/i18n';
import { BodyText, Button, Loading, Notice, spacing } from '@/ui';

import { RatingSummary } from '../reviews/RatingSummary';

import { PartnerScreen } from './PartnerScreen';
import { TeamReviewCard } from './reviews/TeamReviewCard';

export function ReviewsScreen() {
  return <PartnerScreen>{({ camping }) => <ReviewsBody campingId={camping.id} />}</PartnerScreen>;
}

/** The camping's reviews with their public replies (SPEC F11 Reviews: owner, staff). */
function ReviewsBody({ campingId }: { campingId: string }) {
  const t = useT();
  const reviews = useTeamReviews(campingId);
  const reply = useReplyToReview();

  if (reviews.isPending) return <Loading label={t('common.loading')} />;
  if (reviews.isError)
    return (
      <View style={styles.page}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void reviews.refetch()} />
      </View>
    );
  if (reviews.data.length === 0) return <Notice message={t('partner.reviews.empty')} />;

  const rating = visibleRating(reviews.data);
  return (
    <View style={styles.page}>
      {rating && rating.count >= MIN_REVIEWS_FOR_RATING ? (
        <RatingSummary rating={rating} size={18} />
      ) : (
        <BodyText>
          {t('partner.reviews.ratingLater', {
            min: MIN_REVIEWS_FOR_RATING,
            count: rating?.count ?? 0,
          })}
        </BodyText>
      )}
      {reviews.data.map((review) => (
        <TeamReviewCard
          key={review.id}
          review={review}
          saving={reply.isPending && reply.variables?.reviewId === review.id}
          failed={reply.isError && reply.variables?.reviewId === review.id}
          onReply={(text) => reply.mutate({ reviewId: review.id, reply: text })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
});
