import type { GuestBooking } from '@/api/guestBooking';
import { CANNOT_REVIEW, type ReviewInput } from '@/domain/reviews';
import { errorCode } from '@/domain/errors';
import { useT } from '@/i18n';
import { BodyText, Card, Stars } from '@/ui';

import { ReviewForm } from './ReviewForm';

type Props = {
  booking: Pick<GuestBooking, 'can_review' | 'review'>;
  onSubmit: (input: ReviewInput) => void;
  submitting: boolean;
  submitError: unknown;
};

/** On the guest's booking: their review, or the form once the stay is completed. */
export function StayReview({ booking, onSubmit, submitting, submitError }: Props) {
  const t = useT();
  const { review } = booking;
  if (review)
    return (
      <Card title={t('reviews.mine')}>
        <Stars rating={review.rating} label={t('reviews.stars', { rating: review.rating })} />
        {review.body ? <BodyText>{review.body}</BodyText> : null}
        {review.partner_reply ? (
          <BodyText>{t('reviews.replyText', { reply: review.partner_reply })}</BodyText>
        ) : null}
        {review.hidden ? <BodyText>{t('reviews.hiddenNote')}</BodyText> : null}
      </Card>
    );
  if (!booking.can_review) return null;
  const error = submitError
    ? errorCode(submitError) === CANNOT_REVIEW
      ? t('reviews.form.notAllowed')
      : t('common.error')
    : null;
  return (
    <Card title={t('reviews.form.title')}>
      <ReviewForm onSubmit={onSubmit} submitting={submitting} error={error} />
    </Card>
  );
}
