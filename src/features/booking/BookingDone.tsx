import { router } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';

import type { CreateBookingResponse } from '@/api/booking';
import { useLanguage, useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { siteUrl } from '@/lib/site';
import { BodyText, Button, Card, Icon, colors, spacing } from '@/ui';

type Booked = Extract<CreateBookingResponse, { booked: true }>;

/** Confirmed, or request sent: the reference and the manage link to keep (SPEC F3, F7). */
export function BookingDone({
  result,
  campingName,
  requestHours,
}: {
  result: Booked;
  campingName: string;
  requestHours: number;
}) {
  const t = useT();
  const { language } = useLanguage();
  const confirmed = result.status === 'confirmed';
  const site = siteUrl();
  const link = site ? `${site}/m?ref=${result.ref}&t=${result.manageToken}` : null;

  return (
    <Card>
      <View style={styles.heading}>
        <Icon
          name={confirmed ? 'check-circle' : 'clock-outline'}
          size={32}
          color={colors.primary}
        />
        <Text style={styles.title} accessibilityRole="header">
          {confirmed ? t('booking.done.confirmed') : t('booking.done.requested')}
        </Text>
      </View>
      <Text style={styles.ref} selectable testID="booking-ref">
        {t('booking.done.ref', { ref: result.ref })}
      </Text>
      <BodyText>
        {confirmed
          ? t('booking.done.confirmedBody', {
              camping: campingName,
              price: formatMoney(result.totalCents, language),
            })
          : t('booking.done.requestedBody', { camping: campingName, hours: requestHours })}
      </BodyText>
      <BodyText>{t('booking.done.keepLink')}</BodyText>
      {link ? (
        <Text style={styles.link} selectable testID="booking-link">
          {link}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={t('booking.done.open')}
          variant="primary"
          onPress={() =>
            router.push({ pathname: '/m', params: { ref: result.ref, t: result.manageToken } })
          }
          testID="booking-open"
        />
        {link ? (
          <Button
            label={t('booking.done.share')}
            icon="share-variant"
            onPress={() => {
              // Not every browser can share; the link above can be copied instead.
              Share.share({ message: link }).catch(() => {});
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text },
  ref: { fontSize: 20, fontWeight: '700', color: colors.primary, letterSpacing: 1 },
  link: { fontSize: 14, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
