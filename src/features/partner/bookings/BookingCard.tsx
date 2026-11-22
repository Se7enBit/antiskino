import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import type { BookingAction, CampingBooking } from '@/api/partnerBookings';
import { shortTime } from '@/domain/camping';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput, type IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Badge, BodyText, Button, colors, spacing } from '@/ui';

import { BookingActions } from './BookingActions';
import { RequestDeadline } from './RequestDeadline';
import { STATUS_TONES } from './statusTones';

type Props = {
  booking: CampingBooking;
  today: IsoDate;
  onAction: (action: BookingAction, reason?: string) => void;
  busy: boolean;
  failed: boolean;
  /** Warn when no pitch is assigned yet (Today's arrivals). */
  pitchWarning?: boolean;
};

/** Opens a booking's detail page. */
export function openBooking(ref: string) {
  router.push({ pathname: '/partner/bookings/detail', params: { ref } });
}

/** One booking for the camping's team: guest, stay, contact and what can be done now. */
export function BookingCard({ booking, today, onAction, busy, failed, pitchWarning }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const eta = shortTime(booking.arrival_eta);
  // Every card has the same buttons: screen readers hear whose booking each is for.
  const item = (action: string) => t('a11y.itemAction', { action, item: booking.guest_name });

  return (
    <View style={styles.card} testID={`partner-booking-${booking.ref}`}>
      <View style={styles.top}>
        <Text style={styles.name}>{booking.guest_name}</Text>
        <Badge label={t(`bookingStatus.${booking.status}`)} tone={STATUS_TONES[booking.status]} />
      </View>
      <BodyText>
        {formatDateInput(booking.arrival)} → {formatDateInput(booking.departure)} ·{' '}
        {t('search.nights', { count: booking.nights ?? 0 })} ·{' '}
        {localized(booking.pitch_type.name, language)}
      </BodyText>
      <BodyText>
        {t('partner.bookings.people', { count: booking.party_size })} ·{' '}
        {t(`equipment.${booking.equipment}`)} · {formatMoney(booking.total_cents, language)} ·{' '}
        {booking.ref}
      </BodyText>
      {booking.assigned_pitch ? (
        <Text style={styles.pitch}>
          {t('partner.booking.pitch', { pitch: booking.assigned_pitch })}
        </Text>
      ) : pitchWarning ? (
        <Text style={styles.unassigned}>{t('partner.booking.unassigned')}</Text>
      ) : null}
      {booking.status === 'requested' && booking.request_expires_at ? (
        <RequestDeadline deadline={booking.request_expires_at} />
      ) : null}
      {eta ? <BodyText>{t('partner.bookings.eta', { time: eta })}</BodyText> : null}
      {booking.vehicle_plate ? (
        <BodyText>{t('partner.bookings.plate', { plate: booking.vehicle_plate })}</BodyText>
      ) : null}
      {booking.guest_note ? (
        <BodyText>{t('partner.bookings.note', { note: booking.guest_note })}</BodyText>
      ) : null}
      {booking.cancel_reason ? (
        <BodyText>{t('manage.cancelReason', { reason: booking.cancel_reason })}</BodyText>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={t('partner.booking.open')}
          accessibilityLabel={item(t('partner.booking.open'))}
          icon="file-document-outline"
          onPress={() => openBooking(booking.ref)}
          testID={`open-${booking.ref}`}
        />
        <Button
          label={`${t('partner.bookings.call')} ${booking.guest_phone}`}
          accessibilityLabel={item(`${t('partner.bookings.call')} ${booking.guest_phone}`)}
          icon="phone"
          onPress={() => void Linking.openURL(`tel:${booking.guest_phone.replace(/\s/g, '')}`)}
        />
        <Button
          label={t('partner.bookings.emailGuest')}
          accessibilityLabel={item(t('partner.bookings.emailGuest'))}
          icon="email-outline"
          onPress={() => void Linking.openURL(`mailto:${booking.guest_email}`)}
        />
      </View>
      <BookingActions
        booking={booking}
        today={today}
        onAction={onAction}
        busy={busy}
        failed={failed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  pitch: { fontSize: 15, fontWeight: '700', color: colors.primary },
  unassigned: { fontSize: 15, fontWeight: '700', color: colors.danger },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
