import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAdminReviews, useSetReviewHidden, type AdminReview } from '@/api/adminReviews';
import { useT } from '@/i18n';
import { Badge, Button, Loading, Notice, Screen, TextField, colors, spacing } from '@/ui';

import { ReviewItem } from '../reviews/ReviewItem';

/** /admin/reviews: hide a review with a reason, or show it again (SPEC F12). */
export function ReviewsModeration() {
  const t = useT();
  const [onlyHidden, setOnlyHidden] = useState(false);
  const reviews = useAdminReviews(onlyHidden);
  const setHidden = useSetReviewHidden();

  return (
    <Screen>
      <View style={styles.row}>
        <Button
          label={t('admin.reviews.all')}
          selected={!onlyHidden}
          onPress={() => setOnlyHidden(false)}
        />
        <Button
          label={t('admin.reviews.hiddenOnly')}
          selected={onlyHidden}
          onPress={() => setOnlyHidden(true)}
          testID="only-hidden"
        />
      </View>
      {reviews.isPending ? <Loading label={t('common.loading')} /> : null}
      {reviews.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {reviews.data?.length === 0 ? <Notice message={t('admin.reviews.empty')} /> : null}
      {reviews.data?.map((review) => (
        <ModeratedReview
          key={review.id}
          review={review}
          busy={setHidden.isPending && setHidden.variables?.reviewId === review.id}
          failed={setHidden.isError && setHidden.variables?.reviewId === review.id}
          onSet={(hidden, reason) => setHidden.mutate({ reviewId: review.id, hidden, reason })}
        />
      ))}
    </Screen>
  );
}

type Props = {
  review: AdminReview;
  busy: boolean;
  failed: boolean;
  onSet: (hidden: boolean, reason: string) => void;
};

function ModeratedReview({ review, busy, failed, onSet }: Props) {
  const t = useT();
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);

  return (
    <View style={styles.card} testID={`admin-review-${review.id}`}>
      <View style={styles.top}>
        <Text style={styles.camping}>{review.camping?.name}</Text>
        {review.hidden ? <Badge label={t('admin.reviews.hiddenBadge')} tone="warning" /> : null}
      </View>
      <ReviewItem review={review} />
      {failed ? <Notice tone="error" message={t('common.error')} /> : null}
      {review.hidden ? (
        <>
          <Notice message={t('admin.reviews.reason', { reason: review.hidden_reason ?? '' })} />
          <View style={styles.row}>
            <Button
              label={t('admin.reviews.show')}
              loading={busy}
              onPress={() => onSet(false, '')}
              testID={`show-${review.id}`}
            />
          </View>
        </>
      ) : hiding ? (
        <View style={styles.form}>
          <TextField
            label={t('admin.reviews.reasonLabel')}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              setMissing(false);
            }}
            error={missing ? t('admin.reviews.reasonRequired') : null}
            maxLength={500}
            testID={`hide-reason-${review.id}`}
          />
          <View style={styles.row}>
            <Button
              label={t('admin.reviews.hideConfirm')}
              variant="primary"
              loading={busy}
              onPress={() => {
                if (reason.trim().length < 3) return setMissing(true);
                onSet(true, reason.trim());
                setHiding(false);
              }}
              testID={`hide-confirm-${review.id}`}
            />
            <Button label={t('common.cancel')} onPress={() => setHiding(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button
            label={t('admin.reviews.hide')}
            onPress={() => setHiding(true)}
            testID={`hide-${review.id}`}
          />
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
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  camping: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  form: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
