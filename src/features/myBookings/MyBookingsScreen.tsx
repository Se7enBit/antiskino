import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import type { BookingStatus } from '@/api/guestBooking';
import { useMyBookings, type MyBookingItem } from '@/api/myBookings';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput, todayInAthens } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Badge,
  BodyText,
  Button,
  Loading,
  Notice,
  Screen,
  SectionLabel,
  colors,
  spacing,
} from '@/ui';

/** Still ahead: shown first, soonest first. */
const OPEN: BookingStatus[] = ['held', 'requested', 'confirmed', 'checked_in'];

/** The Bookings tab: a signed-in guest's bookings (SPEC F7). */
export function MyBookingsScreen() {
  const t = useT();
  const { status, session } = useAuth();
  if (status === 'loading')
    return (
      <Screen>
        <Loading label={t('common.loading')} />
      </Screen>
    );
  if (!session)
    return (
      <Screen>
        <BodyText>{t('bookings.body')}</BodyText>
        {status === 'signedOut' ? (
          <Button
            label={t('bookings.signIn')}
            variant="primary"
            onPress={() => router.navigate('/account')}
          />
        ) : null}
        <BodyText>{t('bookings.guestHint')}</BodyText>
      </Screen>
    );
  return (
    <Screen>
      <BookingList userId={session.user.id} />
    </Screen>
  );
}

function BookingList({ userId }: { userId: string }) {
  const t = useT();
  const bookings = useMyBookings(userId);
  if (bookings.isPending) return <Loading label={t('common.loading')} />;
  if (bookings.isError)
    return (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void bookings.refetch()} />
      </>
    );
  if (bookings.data.length === 0)
    return (
      <>
        <BodyText>{t('bookings.empty')}</BodyText>
        <Button
          label={t('bookings.findCamping')}
          variant="primary"
          onPress={() => router.navigate('/')}
        />
      </>
    );
  const today = todayInAthens();
  const upcoming = bookings.data.filter((b) => OPEN.includes(b.status) && b.departure >= today);
  const past = bookings.data.filter((b) => !upcoming.includes(b)).reverse();
  return (
    <View style={styles.list}>
      {upcoming.length ? <SectionLabel>{t('bookings.upcoming')}</SectionLabel> : null}
      {upcoming.map((b) => (
        <BookingRow key={b.id} booking={b} />
      ))}
      {past.length ? <SectionLabel>{t('bookings.past')}</SectionLabel> : null}
      {past.map((b) => (
        <BookingRow key={b.id} booking={b} />
      ))}
    </View>
  );
}

function BookingRow({ booking }: { booking: MyBookingItem }) {
  const t = useT();
  const { language } = useLanguage();
  const confirmed = booking.status === 'confirmed' || booking.status === 'checked_in';
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/bookings/detail', params: { ref: booking.ref } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`my-booking-${booking.ref}`}
    >
      <View style={styles.rowTop}>
        <Text style={styles.name}>
          {[booking.campingName, booking.pitchName ? localized(booking.pitchName, language) : null]
            .filter(Boolean)
            .join(' · ') || booking.ref}
        </Text>
        <Badge
          label={t(`bookingStatus.${booking.status}`)}
          tone={confirmed ? 'success' : booking.status === 'requested' ? 'warning' : 'neutral'}
        />
      </View>
      <Text style={styles.muted}>
        {formatDateInput(booking.arrival)} → {formatDateInput(booking.departure)} · {booking.ref} ·{' '}
        {formatMoney(booking.totalCents, language)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { gap: spacing.xs, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
});
