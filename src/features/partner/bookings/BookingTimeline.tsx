import { StyleSheet, Text, View } from 'react-native';

import type { PartnerBooking } from '@/api/partnerBookings';
import { useLanguage, useT } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { BodyText, colors, spacing } from '@/ui';

type Props = { events: PartnerBooking['events']; createdAt: string };

/** What happened to a booking, oldest first (booking_events). */
export function BookingTimeline({ events, createdAt }: Props) {
  const t = useT();
  const { language } = useLanguage();
  if (events.length === 0)
    return (
      <BodyText>
        {t('partner.booking.created', { time: formatDateTime(createdAt, language) })}
      </BodyText>
    );
  return (
    <View style={styles.list}>
      {events.map((event) => (
        <View key={event.id} style={styles.event} testID={`event-${event.to_status}`}>
          <Text style={styles.time}>{formatDateTime(event.at, language)}</Text>
          <BodyText>
            {/* Same status before and after: the guest's details were corrected. */}
            {event.from_status === event.to_status
              ? t('partner.booking.detailsChanged')
              : t(`bookingStatus.${event.to_status}`)}{' '}
            · {t(`partner.booking.actor.${event.actor_kind}`)}
          </BodyText>
          {event.note ? <BodyText>{event.note}</BodyText> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  event: {
    gap: 2,
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  time: { fontSize: 13, color: colors.muted },
});
