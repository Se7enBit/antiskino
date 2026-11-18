import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useUpdateBookingDesk } from '@/api/partnerBookings';
import { useT } from '@/i18n';
import { Button, Notice, TextField, spacing } from '@/ui';

type Props = {
  booking: { id: string; assigned_pitch: string | null; internal_note: string | null };
};

/** The pitch reception gives the guest, and a note only the team sees (update_booking_desk). */
export function DeskForm({ booking }: Props) {
  const t = useT();
  const save = useUpdateBookingDesk();
  const [pitch, setPitch] = useState(booking.assigned_pitch ?? '');
  const [note, setNote] = useState(booking.internal_note ?? '');
  const changed =
    pitch.trim() !== (booking.assigned_pitch ?? '') ||
    note.trim() !== (booking.internal_note ?? '');

  return (
    <View style={styles.form}>
      <TextField
        label={t('partner.booking.pitchLabel')}
        value={pitch}
        onChangeText={(text) => {
          setPitch(text);
          save.reset();
        }}
        maxLength={40}
        autoCapitalize="characters"
        testID="desk-pitch"
      />
      <TextField
        label={t('partner.booking.internalNote')}
        value={note}
        onChangeText={(text) => {
          setNote(text);
          save.reset();
        }}
        maxLength={2000}
        multiline
        testID="desk-note"
      />
      {save.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {save.isSuccess && !changed ? <Notice message={t('partner.booking.saved')} /> : null}
      <View style={styles.row}>
        <Button
          label={t('common.save')}
          variant="primary"
          disabled={!changed}
          loading={save.isPending}
          onPress={() =>
            save.mutate({ bookingId: booking.id, assignedPitch: pitch, internalNote: note })
          }
          testID="desk-save"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
