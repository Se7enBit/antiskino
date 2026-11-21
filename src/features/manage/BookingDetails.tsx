import { router } from 'expo-router';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import type { BookingStatus, GuestBooking } from '@/api/guestBooking';
import type { ReviewInput } from '@/domain/reviews';
import { directionsUrl, shortTime } from '@/domain/camping';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Badge, BodyText, Button, Card, ConfirmButton, Notice, colors, spacing } from '@/ui';

import { PriceBreakdown } from '../booking/PriceBreakdown';
import { campingPathname } from '../camping/routes';
import { StayReview } from '../reviews/StayReview';

const TONES: Record<BookingStatus, 'success' | 'warning' | 'neutral'> = {
  held: 'warning',
  requested: 'warning',
  confirmed: 'success',
  checked_in: 'success',
  completed: 'success',
  declined: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
  no_show: 'neutral',
};

type Props = {
  booking: GuestBooking;
  /** Shown while the booking can still be cancelled. */
  onCancel?: () => void;
  cancelling?: boolean;
  cancelFailed?: boolean;
  /** Reviewing the completed stay (SPEC F9). */
  review?: { onSubmit: (input: ReviewInput) => void; submitting: boolean; error: unknown };
};

/** A booking as its guest sees it (manage link and My bookings). */
export function BookingDetails({ booking, onCancel, cancelling, cancelFailed, review }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const { camping, price_breakdown: breakdown } = booking;
  // The snapshot keeps the names at booking time; older rows fall back to today's names.
  const names = {
    pitch: breakdown.names?.pitch ?? booking.pitch_type.name,
    guest: breakdown.names?.guest ?? booking.names.guest,
    extra: breakdown.names?.extra ?? booking.names.extra,
    fee: breakdown.names?.fee ?? booking.names.fee,
  };
  const checkIn = shortTime(camping.check_in_from);
  const checkOut = shortTime(camping.check_out_until);
  const { lat, lng } = camping;

  return (
    <View style={styles.page}>
      <Card>
        <View style={styles.status}>
          <Badge label={t(`bookingStatus.${booking.status}`)} tone={TONES[booking.status]} />
          <Text style={styles.ref} selectable>
            {t('manage.ref', { ref: booking.ref })}
          </Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {camping.name} · {localized(names.pitch, language)}
        </Text>
        {booking.status === 'requested' && booking.request_expires_at ? (
          <BodyText>
            {t('manage.requestedUntil', {
              deadline: formatDateTime(booking.request_expires_at, language),
            })}
          </BodyText>
        ) : null}
        {booking.status === 'declined' ? <BodyText>{t('manage.declined')}</BodyText> : null}
        {booking.status === 'expired' ? <BodyText>{t('manage.expired')}</BodyText> : null}
        {booking.status === 'cancelled' ? (
          <BodyText>
            {t('manage.cancelled')}
            {booking.cancel_reason
              ? ` ${t('manage.cancelReason', { reason: booking.cancel_reason })}`
              : ''}
          </BodyText>
        ) : null}
      </Card>

      {review ? (
        <StayReview
          booking={booking}
          onSubmit={review.onSubmit}
          submitting={review.submitting}
          submitError={review.error}
        />
      ) : null}

      <Card title={t('manage.stay')}>
        <BodyText>
          {formatDateInput(booking.arrival)} → {formatDateInput(booking.departure)} ·{' '}
          {t('search.nights', { count: booking.nights })}
        </BodyText>
        <BodyText>
          {Object.entries(booking.party)
            .map(([id, count]) =>
              t('booking.guestCount', { name: localized(names.guest[id], language), count }),
            )
            .join(' · ')}{' '}
          · {t(`equipment.${booking.equipment}`)}
        </BodyText>
        {checkIn ? <BodyText>{t('camping.checkIn', { time: checkIn })}</BodyText> : null}
        {checkOut ? <BodyText>{t('camping.checkOut', { time: checkOut })}</BodyText> : null}
      </Card>

      <Card title={t('booking.price')}>
        <PriceBreakdown quote={breakdown} names={names} nights={booking.nights} />
        <BodyText>
          {t('booking.review.payOnSite', { price: formatMoney(booking.total_cents, language) })}
        </BodyText>
        <BodyText>{t(`camping.cancellation.${booking.cancellation_policy}`)}</BodyText>
        {booking.payment_mode === 'on_site' ? <BodyText>{t('camping.onSiteFree')}</BodyText> : null}
      </Card>

      <Card title={t('booking.steps.details')}>
        <BodyText>{booking.guest.name}</BodyText>
        <BodyText>{booking.guest.email}</BodyText>
        <BodyText>{booking.guest.phone}</BodyText>
      </Card>

      <Card title={t('manage.contact')}>
        {camping.address ? <BodyText>{camping.address}</BodyText> : null}
        {camping.phone ? <BodyText>{camping.phone}</BodyText> : null}
        {camping.email ? <BodyText>{camping.email}</BodyText> : null}
        <View style={styles.actions}>
          <Button
            label={t('manage.openCamping')}
            onPress={() =>
              router.push({ pathname: campingPathname(language), params: { slug: camping.slug } })
            }
          />
          {lat !== null && lng !== null ? (
            <Button
              label={t('camping.directions')}
              icon="directions"
              onPress={() => void Linking.openURL(directionsUrl(lat, lng, Platform.OS))}
            />
          ) : null}
        </View>
      </Card>

      {booking.can_cancel && onCancel ? (
        <Card>
          <BodyText>{t('manage.changeHint')}</BodyText>
          {cancelFailed ? <Notice tone="error" message={t('common.error')} /> : null}
          <ConfirmButton
            label={t('manage.cancel')}
            question={t('manage.cancelQuestion')}
            yes={t('manage.cancelYes')}
            no={t('manage.cancelNo')}
            onConfirm={onCancel}
            loading={cancelling}
            testID="booking-cancel"
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  ref: { fontSize: 15, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
