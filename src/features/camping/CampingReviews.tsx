import { StyleSheet, Text, View } from 'react-native';

import { useCampingReviews } from '@/api/reviews';
import { useT } from '@/i18n';
import { BodyText, Button, Notice, colors, spacing } from '@/ui';

import { RatingSummary } from '../reviews/RatingSummary';
import { ReviewItem } from '../reviews/ReviewItem';

/** The camping page's reviews: the rating (from 3 reviews) and the latest reviews. */
export function CampingReviews({ campingId }: { campingId: string }) {
  const t = useT();
  const reviews = useCampingReviews(campingId);
  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('reviews.title')}
      </Text>
      {reviews.isError ? (
        <>
          <Notice tone="error" message={t('common.error')} />
          <Button label={t('common.retry')} onPress={() => void reviews.refetch()} />
        </>
      ) : null}
      {reviews.data ? (
        <>
          <RatingSummary rating={reviews.data.rating} size={18} />
          {reviews.data.reviews.length === 0 ? <BodyText>{t('reviews.none')}</BodyText> : null}
          {reviews.data.reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
          <Text style={styles.note}>{t('reviews.verified')}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  note: { fontSize: 13, color: colors.muted },
});
