import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BookingAction } from '@/api/partnerBookings';
import { receptionActions } from '@/domain/partnerBookings';
import { useT } from '@/i18n';
import type { IsoDate } from '@/lib/dates';
import { Button, ConfirmButton, Notice, TextField, spacing } from '@/ui';

type Props = {
  booking: { ref: string; status: string; arrival: IsoDate };
  today: IsoDate;
  onAction: (action: BookingAction, reason?: string) => void;
  busy: boolean;
  failed: boolean;
};

/** The buttons for what the camping can do with a booking now (list cards and the detail page). */
export function BookingActions({ booking, today, onAction, busy, failed }: Props) {
  const t = useT();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const actions = receptionActions(booking, today);
  if (actions.length === 0) return null;
  const { ref } = booking;

  return (
    <View style={styles.block}>
      {failed ? <Notice tone="error" message={t('common.error')} /> : null}
      <View style={styles.row}>
        {actions.includes('accept') ? (
          <Button
            label={t('partner.bookings.accept')}
            variant="primary"
            onPress={() => onAction('accept')}
            loading={busy}
            testID={`accept-${ref}`}
          />
        ) : null}
        {actions.includes('decline') ? (
          <ConfirmButton
            label={t('partner.bookings.decline')}
            question={t('partner.bookings.declineQuestion')}
            yes={t('partner.bookings.declineYes')}
            no={t('manage.cancelNo')}
            onConfirm={() => onAction('decline')}
            loading={busy}
            testID={`decline-${ref}`}
          />
        ) : null}
        {actions.includes('check_in') ? (
          <Button
            label={t('partner.bookings.checkIn')}
            variant="primary"
            icon="check"
            onPress={() => onAction('check_in')}
            loading={busy}
            testID={`check-in-${ref}`}
          />
        ) : null}
        {actions.includes('no_show') ? (
          <ConfirmButton
            label={t('partner.bookings.noShow')}
            question={t('partner.bookings.noShowQuestion')}
            yes={t('partner.bookings.noShowYes')}
            no={t('manage.cancelNo')}
            onConfirm={() => onAction('no_show')}
            loading={busy}
            testID={`no-show-${ref}`}
          />
        ) : null}
        {actions.includes('cancel') && !cancelling ? (
          <Button
            label={t('partner.bookings.cancel')}
            onPress={() => setCancelling(true)}
            testID={`cancel-${ref}`}
          />
        ) : null}
      </View>
      {actions.includes('cancel') && cancelling ? (
        <View style={styles.block}>
          <TextField
            label={t('partner.bookings.cancelReason')}
            value={reason}
            onChangeText={setReason}
            error={reasonMissing ? t('partner.bookings.reasonRequired') : null}
            multiline
            testID={`cancel-reason-${ref}`}
          />
          <View style={styles.row}>
            <Button
              label={t('partner.bookings.cancelConfirm')}
              variant="primary"
              loading={busy}
              onPress={() => {
                if (reason.trim().length < 3) return setReasonMissing(true);
                onAction('cancel', reason.trim());
              }}
              testID={`cancel-confirm-${ref}`}
            />
            <Button label={t('partner.bookings.keep')} onPress={() => setCancelling(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
