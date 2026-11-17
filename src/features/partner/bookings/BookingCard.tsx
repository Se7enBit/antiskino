import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import type { BookingAction, CampingBooking } from '@/api/partnerBookings';
import { shortTime } from '@/domain/camping';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Badge, BodyText, Button, ConfirmButton, Notice, TextField, colors, spacing } from '@/ui';

type Props = {
  booking: CampingBooking;
  onAction: (action: BookingAction, reason?: string) => void;
  busy: boolean;
  failed: boolean;
};

/** One booking for the camping's team: guest, stay, contact and what can be done now. */
export function BookingCard({ booking, onAction, busy, failed }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const eta = shortTime(booking.arrival_eta);
  // Requests are declined, not cancelled.
  const cancellable = booking.status === 'confirmed';

  return (
    <View style={styles.card} testID={`partner-booking-${booking.ref}`}>
      <View style={styles.top}>
        <Text style={styles.name}>{booking.guest_name}</Text>
        <Badge
          label={t(`bookingStatus.${booking.status}`)}
          tone={
            booking.status === 'confirmed'
              ? 'success'
              : booking.status === 'requested'
                ? 'warning'
                : 'neutral'
          }
        />
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
      {booking.status === 'requested' && booking.request_expires_at ? (
        <Text style={styles.deadline}>
          {t('partner.bookings.answerBy', {
            deadline: formatDateTime(booking.request_expires_at, language),
          })}
        </Text>
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
          label={`${t('partner.bookings.call')} ${booking.guest_phone}`}
          icon="phone"
          onPress={() => void Linking.openURL(`tel:${booking.guest_phone.replace(/\s/g, '')}`)}
        />
        <Button
          label={t('partner.bookings.emailGuest')}
          icon="email-outline"
          onPress={() => void Linking.openURL(`mailto:${booking.guest_email}`)}
        />
      </View>

      {failed ? <Notice tone="error" message={t('common.error')} /> : null}
      {booking.status === 'requested' ? (
        <View style={styles.actions}>
          <Button
            label={t('partner.bookings.accept')}
            variant="primary"
            onPress={() => onAction('accept')}
            loading={busy}
            testID={`accept-${booking.ref}`}
          />
          <ConfirmButton
            label={t('partner.bookings.decline')}
            question={t('partner.bookings.declineQuestion')}
            yes={t('partner.bookings.declineYes')}
            no={t('manage.cancelNo')}
            onConfirm={() => onAction('decline')}
            loading={busy}
            testID={`decline-${booking.ref}`}
          />
        </View>
      ) : null}
      {cancellable && !cancelling ? (
        <Button
          label={t('partner.bookings.cancel')}
          onPress={() => setCancelling(true)}
          testID={`cancel-${booking.ref}`}
        />
      ) : null}
      {cancellable && cancelling ? (
        <View style={styles.cancel}>
          <TextField
            label={t('partner.bookings.cancelReason')}
            value={reason}
            onChangeText={setReason}
            error={reasonMissing ? t('partner.bookings.reasonRequired') : null}
            multiline
            testID={`cancel-reason-${booking.ref}`}
          />
          <View style={styles.actions}>
            <Button
              label={t('partner.bookings.cancelConfirm')}
              variant="primary"
              loading={busy}
              onPress={() => {
                if (reason.trim().length < 3) return setReasonMissing(true);
                onAction('cancel', reason.trim());
              }}
              testID={`cancel-confirm-${booking.ref}`}
            />
            <Button label={t('partner.bookings.keep')} onPress={() => setCancelling(false)} />
          </View>
        </View>
      ) : null}
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
  deadline: { fontSize: 15, fontWeight: '700', color: colors.danger },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancel: { gap: spacing.sm, marginTop: spacing.xs },
});
