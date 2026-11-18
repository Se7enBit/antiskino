import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TeamReview } from '@/api/partnerReviews';
import { useT } from '@/i18n';
import { BodyText, Button, Notice, TextField, colors, spacing } from '@/ui';

import { openBooking } from '../bookings/BookingCard';
import { ReviewItem } from '../../reviews/ReviewItem';

type Props = {
  review: TeamReview;
  onReply: (reply: string) => void;
  saving: boolean;
  failed: boolean;
};

/** A review for the camping's team: whose stay it was, moderation, and the public reply. */
export function TeamReviewCard({ review, onReply, saving, failed }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.partner_reply ?? '');

  return (
    <View style={styles.card} testID={`team-review-${review.id}`}>
      <ReviewItem review={review} showReply={false} />
      {review.booking ? (
        <Button
          label={t('partner.reviews.booking', {
            ref: review.booking.ref,
            name: review.booking.guest_name,
          })}
          onPress={() => review.booking && openBooking(review.booking.ref)}
        />
      ) : null}
      {review.hidden ? (
        <Notice message={t('partner.reviews.hidden', { reason: review.hidden_reason ?? '' })} />
      ) : null}
      {editing ? (
        <View style={styles.reply}>
          <TextField
            label={t('partner.reviews.replyLabel')}
            value={text}
            onChangeText={setText}
            maxLength={1000}
            multiline
            testID={`reply-text-${review.id}`}
          />
          {failed ? <Notice tone="error" message={t('common.error')} /> : null}
          <View style={styles.row}>
            <Button
              label={t('partner.reviews.publish')}
              variant="primary"
              loading={saving}
              onPress={() => {
                onReply(text);
                setEditing(false);
              }}
              testID={`reply-save-${review.id}`}
            />
            <Button
              label={t('common.cancel')}
              onPress={() => {
                setText(review.partner_reply ?? '');
                setEditing(false);
              }}
            />
          </View>
          <BodyText>{t('partner.reviews.replyHint')}</BodyText>
        </View>
      ) : (
        <View style={styles.reply}>
          {review.partner_reply ? (
            <>
              <Text style={styles.replyTitle}>{t('reviews.reply')}</Text>
              <BodyText>{review.partner_reply}</BodyText>
            </>
          ) : null}
          <View style={styles.row}>
            <Button
              label={
                review.partner_reply ? t('partner.reviews.editReply') : t('partner.reviews.reply')
              }
              icon="reply"
              onPress={() => setEditing(true)}
              testID={`reply-${review.id}`}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  reply: { gap: spacing.sm },
  replyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
