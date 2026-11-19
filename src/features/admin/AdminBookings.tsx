import { StyleSheet, Text, View } from 'react-native';

import { ADMIN_BOOKINGS_LIMIT, useAdminBookings, type AdminBooking } from '@/api/admin';
import { useLanguage, useT } from '@/i18n';
import { formatDateInput, todayInAthens } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Badge, BodyText, Card, Loading, Screen, colors, spacing } from '@/ui';

import { BookingFilters, useBookingFilters } from '../bookings/BookingFilters';
import { ErrorState } from '../common/ErrorState';
import { STATUS_TONES } from '../partner/bookings/statusTones';

/** /admin/bookings: every camping's bookings, read-only (SPEC F12). */
export function AdminBookings() {
  const t = useT();
  const filters = useBookingFilters(todayInAthens());
  const bookings = useAdminBookings(filters.range);

  let body;
  if (bookings.isPending) body = <Loading label={t('common.loading')} />;
  else if (bookings.isError) body = <ErrorState onRetry={() => void bookings.refetch()} />;
  else {
    const matches = filters.apply(bookings.data);
    body = (
      <Card title={t('partner.bookings.filter.count', { count: matches.length })}>
        {matches.length === 0 ? <BodyText>{t('partner.bookings.filter.none')}</BodyText> : null}
        {matches.map((booking) => (
          <AdminBookingRow key={booking.id} booking={booking} />
        ))}
        {bookings.data.length >= ADMIN_BOOKINGS_LIMIT ? (
          <BodyText>{t('admin.bookings.limit', { count: ADMIN_BOOKINGS_LIMIT })}</BodyText>
        ) : null}
      </Card>
    );
  }

  return (
    <Screen>
      <BookingFilters filters={filters} />
      {body}
    </Screen>
  );
}

function AdminBookingRow({ booking }: { booking: AdminBooking }) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <View style={styles.row} testID={`admin-booking-${booking.ref}`}>
      <View style={styles.top}>
        <Text style={styles.name}>
          {booking.camping?.name} · {booking.guest_name}
        </Text>
        <Badge label={t(`bookingStatus.${booking.status}`)} tone={STATUS_TONES[booking.status]} />
      </View>
      <BodyText>
        {formatDateInput(booking.arrival)} → {formatDateInput(booking.departure)} ·{' '}
        {t('search.nights', { count: booking.nights ?? 0 })} ·{' '}
        {t('partner.bookings.people', { count: booking.party_size })} · {booking.ref}
      </BodyText>
      <BodyText>
        {formatMoney(booking.total_cents, language)} ·{' '}
        {t('admin.bookings.commission', {
          amount: formatMoney(booking.commission_cents, language),
        })}
      </BodyText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
});
