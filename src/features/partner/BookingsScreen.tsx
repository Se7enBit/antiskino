import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useCampingBookings,
  usePartnerBookingAction,
  type CampingBooking,
} from '@/api/partnerBookings';
import { useT } from '@/i18n';
import { todayInAthens } from '@/lib/dates';
import { BodyText, Button, Card, Loading, Notice, spacing } from '@/ui';

import { BookingCard } from './bookings/BookingCard';
import { PartnerScreen } from './PartnerScreen';

export function BookingsScreen() {
  return <PartnerScreen>{({ camping }) => <BookingsBody campingId={camping.id} />}</PartnerScreen>;
}

/** Requests first, then upcoming stays; past and cancelled ones on demand (SPEC F11, M4 part). */
function BookingsBody({ campingId }: { campingId: string }) {
  const t = useT();
  const bookings = useCampingBookings(campingId);
  const action = usePartnerBookingAction(campingId);
  const [showPast, setShowPast] = useState(false);

  if (bookings.isPending) return <Loading label={t('common.loading')} />;
  if (bookings.isError)
    return (
      <View style={styles.page}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void bookings.refetch()} />
      </View>
    );
  const today = todayInAthens();
  const all = bookings.data;
  const requests = all.filter((b) => b.status === 'requested');
  const upcoming = all.filter(
    (b) => ['confirmed', 'checked_in'].includes(b.status) && b.departure >= today,
  );
  const past = all.filter((b) => !requests.includes(b) && !upcoming.includes(b)).reverse();

  const card = (booking: CampingBooking) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      busy={action.isPending && action.variables?.bookingId === booking.id}
      failed={action.isError && action.variables?.bookingId === booking.id}
      onAction={(kind, reason) => action.mutate({ bookingId: booking.id, action: kind, reason })}
    />
  );

  return (
    <View style={styles.page}>
      {all.length === 0 ? <Notice message={t('partner.bookings.empty')} /> : null}
      {requests.length ? (
        <Card title={t('partner.bookings.requests')}>
          <View style={styles.list}>{requests.map(card)}</View>
        </Card>
      ) : null}
      {upcoming.length ? (
        <Card title={t('partner.bookings.upcoming')}>
          <View style={styles.list}>{upcoming.map(card)}</View>
        </Card>
      ) : null}
      {past.length ? (
        <>
          <Button
            label={showPast ? t('partner.bookings.hidePast') : t('partner.bookings.showPast')}
            onPress={() => setShowPast((shown) => !shown)}
            testID="toggle-past"
          />
          {showPast ? (
            <Card title={t('partner.bookings.past')}>
              <View style={styles.list}>{past.map(card)}</View>
            </Card>
          ) : null}
        </>
      ) : null}
      {all.length && !requests.length && !upcoming.length && !showPast ? (
        <BodyText>{t('partner.bookings.empty')}</BodyText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  list: { gap: spacing.sm },
});
