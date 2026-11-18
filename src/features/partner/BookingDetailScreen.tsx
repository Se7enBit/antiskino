import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  usePartnerBooking,
  usePartnerBookingAction,
  type PartnerBooking,
} from '@/api/partnerBookings';
import { shortTime } from '@/domain/camping';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput, todayInAthens } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { useHydrated } from '@/lib/useHydrated';
import { Badge, BodyText, Button, Card, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { PriceBreakdown } from '../booking/PriceBreakdown';

import { BookingActions } from './bookings/BookingActions';
import { BookingTimeline } from './bookings/BookingTimeline';
import { DeskForm } from './bookings/DeskForm';
import { STATUS_TONES } from './bookings/statusTones';

/** /partner/bookings/detail?ref=ANT-…: one booking with everything reception needs (SPEC F11). */
export function BookingDetailScreen() {
  const t = useT();
  const params = useLocalSearchParams();
  // The static page is built without URL parameters.
  const hydrated = useHydrated();
  const ref = hydrated && typeof params.ref === 'string' ? params.ref : undefined;
  const booking = usePartnerBooking(ref);

  let body;
  if (!hydrated || (ref && booking.isPending)) body = <Loading label={t('common.loading')} />;
  else if (booking.isError)
    body = (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void booking.refetch()} />
      </>
    );
  else if (!booking.data) body = <Notice message={t('partner.booking.notFound')} />;
  else body = <BookingDetail booking={booking.data} />;
  return <Screen>{body}</Screen>;
}

function BookingDetail({ booking }: { booking: PartnerBooking }) {
  const t = useT();
  const { language } = useLanguage();
  const action = usePartnerBookingAction();
  const breakdown = booking.price_breakdown;
  const names = {
    pitch: breakdown?.names?.pitch ?? booking.pitch_type.name,
    guest: breakdown?.names?.guest ?? {},
    extra: breakdown?.names?.extra ?? {},
    fee: breakdown?.names?.fee ?? {},
  };
  const eta = shortTime(booking.arrival_eta);
  const country = t(`countries.${booking.guest_country}`, { defaultValue: booking.guest_country });

  return (
    <View style={styles.page}>
      <Card>
        <View style={styles.top}>
          <Text style={styles.name} accessibilityRole="header">
            {booking.guest_name}
          </Text>
          <Badge label={t(`bookingStatus.${booking.status}`)} tone={STATUS_TONES[booking.status]} />
        </View>
        <Text style={styles.ref} selectable>
          {booking.ref}
        </Text>
        <BodyText>
          {formatDateInput(booking.arrival)} → {formatDateInput(booking.departure)} ·{' '}
          {t('search.nights', { count: booking.nights ?? 0 })} · {localized(names.pitch, language)}
        </BodyText>
        <Text style={booking.assigned_pitch ? styles.pitch : styles.unassigned}>
          {booking.assigned_pitch
            ? t('partner.booking.pitch', { pitch: booking.assigned_pitch })
            : t('partner.booking.unassigned')}
        </Text>
        {booking.status === 'requested' && booking.request_expires_at ? (
          <Text style={styles.deadline}>
            {t('partner.bookings.answerBy', {
              deadline: formatDateTime(booking.request_expires_at, language),
            })}
          </Text>
        ) : null}
        {booking.cancel_reason ? (
          <BodyText>{t('manage.cancelReason', { reason: booking.cancel_reason })}</BodyText>
        ) : null}
        <BookingActions
          booking={booking}
          today={todayInAthens()}
          onAction={(kind, reason) =>
            action.mutate({ bookingId: booking.id, action: kind, reason })
          }
          busy={action.isPending}
          failed={action.isError}
        />
        {booking.status === 'confirmed' && booking.arrival > todayInAthens() ? (
          <BodyText>{t('partner.booking.checkInFrom')}</BodyText>
        ) : null}
      </Card>

      <Card title={t('partner.booking.desk')}>
        <DeskForm booking={booking} />
      </Card>

      <Card title={t('partner.booking.guest')}>
        <BodyText>{booking.guest_name}</BodyText>
        <BodyText>
          {t('partner.booking.country', { country })} ·{' '}
          {t('partner.booking.language', {
            language: t(`partner.booking.locale.${booking.locale === 'el' ? 'el' : 'en'}`),
          })}
        </BodyText>
        {eta ? <BodyText>{t('partner.bookings.eta', { time: eta })}</BodyText> : null}
        {booking.vehicle_plate ? (
          <BodyText>{t('partner.bookings.plate', { plate: booking.vehicle_plate })}</BodyText>
        ) : null}
        {booking.guest_note ? (
          <BodyText>{t('partner.bookings.note', { note: booking.guest_note })}</BodyText>
        ) : null}
        <View style={styles.row}>
          <Button
            label={`${t('partner.bookings.call')} ${booking.guest_phone}`}
            icon="phone"
            onPress={() => void Linking.openURL(`tel:${booking.guest_phone.replace(/\s/g, '')}`)}
          />
          <Button
            label={booking.guest_email}
            icon="email-outline"
            onPress={() => void Linking.openURL(`mailto:${booking.guest_email}`)}
          />
        </View>
      </Card>

      <Card title={t('partner.booking.stay')}>
        <BodyText>
          {Object.entries(booking.party)
            .map(([id, count]) =>
              t('booking.guestCount', {
                name: localized(names.guest[id], language) || t('partner.booking.guests'),
                count,
              }),
            )
            .join(' · ') || t('partner.bookings.people', { count: booking.party_size })}{' '}
          · {t(`equipment.${booking.equipment}`)}
        </BodyText>
        {breakdown ? (
          <PriceBreakdown quote={breakdown} names={names} nights={booking.nights ?? 0} />
        ) : null}
        <BodyText>
          {t(`partner.booking.payment.${booking.payment_mode}`, {
            price: formatMoney(booking.total_cents, language),
          })}
        </BodyText>
        <BodyText>
          {t('partner.booking.commission', {
            amount: formatMoney(booking.commission_cents, language),
          })}
        </BodyText>
        <BodyText>{t(`camping.cancellation.${booking.cancellation_policy}`)}</BodyText>
      </Card>

      <Card title={t('partner.booking.history')}>
        <BookingTimeline events={booking.events} createdAt={booking.created_at} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  ref: { fontSize: 15, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  pitch: { fontSize: 16, fontWeight: '700', color: colors.primary },
  unassigned: { fontSize: 16, fontWeight: '700', color: colors.danger },
  deadline: { fontSize: 15, fontWeight: '700', color: colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
