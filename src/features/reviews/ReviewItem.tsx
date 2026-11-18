import { StyleSheet, Text, View } from 'react-native';

import { useLanguage, useT } from '@/i18n';
import { formatMonth } from '@/lib/format';
import { BodyText, Stars, colors, spacing } from '@/ui';

export type ReviewShown = {
  id: string;
  rating: number;
  body: string | null;
  author_name: string;
  author_country: string;
  stay_month: string;
  partner_reply: string | null;
};

/** One review: stars, text, who and when, and the camping's reply. */
export function ReviewItem({
  review,
  showReply = true,
}: {
  review: ReviewShown;
  /** The team's list shows the reply in its own editor. */
  showReply?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const country = t(`countries.${review.author_country}`, { defaultValue: review.author_country });
  return (
    <View style={styles.review} testID={`review-${review.id}`}>
      <Stars rating={review.rating} label={t('reviews.stars', { rating: review.rating })} />
      {review.body ? <BodyText>{review.body}</BodyText> : null}
      <Text style={styles.meta}>
        {t('reviews.meta', {
          name: review.author_name,
          country,
          month: formatMonth(review.stay_month, language),
        })}
      </Text>
      {showReply && review.partner_reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyTitle}>{t('reviews.reply')}</Text>
          <BodyText>{review.partner_reply}</BodyText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  review: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  meta: { fontSize: 14, color: colors.muted },
  reply: {
    gap: 2,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  replyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
});
