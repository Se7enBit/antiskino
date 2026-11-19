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

import { BookingFilters, useBookingFilters } from '../bookings/BookingFilters';

import { BookingCard } from './bookings/BookingCard';
import { PartnerScreen } from './PartnerScreen';

export function BookingsScreen() {
  return <PartnerScreen>{({ camping }) => <BookingsBody campingId={camping.id} />}</PartnerScreen>;
}

/**
 * Requests first, then upcoming stays; past and cancelled ones on demand.
 * Search, a status filter and a date range turn it into one list of matches (SPEC F11).
 */
function BookingsBody({ campingId }: { campingId: string }) {
  const t = useT();
  const today = todayInAthens();
  const filters = useBookingFilters(today);
  const [showPast, setShowPast] = useState(false);
  const bookings = useCampingBookings(campingId, filters.range);
  const action = usePartnerBookingAction();

  const card = (booking: CampingBooking) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      today={today}
      busy={action.isPending && action.variables?.bookingId === booking.id}
      failed={action.isError && action.variables?.bookingId === booking.id}
      onAction={(kind, reason) => action.mutate({ bookingId: booking.id, action: kind, reason })}
    />
  );

  let body;
  if (bookings.isPending) body = <Loading label={t('common.loading')} />;
  else if (bookings.isError)
    body = (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void bookings.refetch()} />
      </>
    );
  else if (filters.active) {
    const matches = filters.apply(bookings.data);
    body = (
      <Card title={t('partner.bookings.filter.count', { count: matches.length })}>
        {matches.length ? (
          <View style={styles.list}>{matches.map(card)}</View>
        ) : (
          <BodyText>{t('partner.bookings.filter.none')}</BodyText>
        )}
      </Card>
    );
  } else {
    const all = bookings.data;
    const requests = all.filter((b) => b.status === 'requested');
    const upcoming = all.filter(
      (b) => ['confirmed', 'checked_in'].includes(b.status) && b.departure >= today,
    );
    const past = all.filter((b) => !requests.includes(b) && !upcoming.includes(b)).reverse();
    body = (
      <>
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
      </>
    );
  }

  return (
    <View style={styles.page}>
      <BookingFilters filters={filters} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  list: { gap: spacing.sm },
});
