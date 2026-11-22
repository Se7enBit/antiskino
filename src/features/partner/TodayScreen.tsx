import { StyleSheet, Text, View } from 'react-native';

import {
  useCampingBookings,
  usePartnerBookingAction,
  type CampingBooking,
} from '@/api/partnerBookings';
import { todayGroups } from '@/domain/today';
import { useT } from '@/i18n';
import { todayInAthens } from '@/lib/dates';
import { BodyText, Button, Card, Loading, Notice, colors, spacing } from '@/ui';

import { BookingCard } from './bookings/BookingCard';
import { PartnerScreen } from './PartnerScreen';

export function TodayScreen() {
  return <PartnerScreen>{({ camping }) => <TodayBody campingId={camping.id} />}</PartnerScreen>;
}

/** Reception's day: requests, arrivals, departures and who stays tonight (SPEC F11). */
function TodayBody({ campingId }: { campingId: string }) {
  const t = useT();
  const today = todayInAthens();
  // Every stay that ends today or later: today's guests and all open requests.
  const bookings = useCampingBookings(campingId, { from: today, to: null });
  const action = usePartnerBookingAction();

  if (bookings.isPending) return <Loading label={t('common.loading')} />;
  if (bookings.isError)
    return (
      <View style={styles.page}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void bookings.refetch()} />
      </View>
    );
  const { arrivals, departures, inHouse, requests } = todayGroups(bookings.data, today);

  const card = (booking: CampingBooking, pitchWarning = false) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      today={today}
      pitchWarning={pitchWarning}
      busy={action.isPending && action.variables?.bookingId === booking.id}
      failed={action.isError && action.variables?.bookingId === booking.id}
      onAction={(kind, reason) => action.mutate({ bookingId: booking.id, action: kind, reason })}
    />
  );

  return (
    <View style={styles.page}>
      <View style={styles.stats}>
        <Stat label={t('partner.today.arrivals')} value={String(arrivals.length)} />
        <Stat label={t('partner.today.departures')} value={String(departures.length)} />
        <Stat
          label={t('partner.today.inHouse')}
          value={String(inHouse.stays)}
          detail={t('partner.bookings.people', { count: inHouse.people })}
        />
      </View>

      {requests.length ? (
        <Card title={t('partner.bookings.requests')}>
          <View style={styles.list}>{requests.map((b) => card(b))}</View>
        </Card>
      ) : null}

      <Card title={t('partner.today.arrivals')}>
        {arrivals.length ? (
          <View style={styles.list}>{arrivals.map((b) => card(b, b.status === 'confirmed'))}</View>
        ) : (
          <BodyText>{t('partner.today.noArrivals')}</BodyText>
        )}
      </Card>

      <Card title={t('partner.today.departures')}>
        {departures.length ? (
          <View style={styles.list}>{departures.map((b) => card(b))}</View>
        ) : (
          <BodyText>{t('partner.today.noDepartures')}</BodyText>
        )}
      </Card>
    </View>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  statValue: { fontSize: 26, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
  statDetail: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  list: { gap: spacing.sm },
});
