import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useGuestBooking, useGuestCancelBooking } from '@/api/guestBooking';
import { useGuestSubmitReview } from '@/api/reviews';
import { useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { Button, Loading, Notice, Screen, colors } from '@/ui';

import { PageHead } from '../common/PageHead';

import { BookingDetails } from './BookingDetails';

const param = (value: unknown) =>
  typeof value === 'string' && value.length <= 100 ? value : undefined;

/** /m?ref=…&t=…: the guest's manage link, no account needed (SPEC F7). */
export function ManageBookingScreen() {
  const t = useT();
  const params = useLocalSearchParams();
  // The static page is built without the link's parameters.
  const hydrated = useHydrated();
  const ref = hydrated ? param(params.ref) : undefined;
  const token = hydrated ? param(params.t) : undefined;
  return (
    <Screen>
      <PageHead title={`${t('manage.title')} · Antiskino`} />
      <Text style={styles.title} accessibilityRole="header">
        {t('manage.title')}
      </Text>
      {!hydrated ? <Loading label={t('common.loading')} /> : null}
      {hydrated && (!ref || !token) ? <NotFound /> : null}
      {ref && token ? <ManageBooking bookingRef={ref} token={token} /> : null}
    </Screen>
  );
}

function NotFound() {
  const t = useT();
  return (
    <>
      <Notice message={t('manage.notFound')} />
      <Button label={t('manage.backToApp')} onPress={() => router.navigate('/')} />
    </>
  );
}

function ManageBooking({ bookingRef, token }: { bookingRef: string; token: string }) {
  const t = useT();
  const booking = useGuestBooking(bookingRef, token);
  const cancel = useGuestCancelBooking(bookingRef, token);
  const review = useGuestSubmitReview(bookingRef, token);
  if (booking.isPending) return <Loading label={t('common.loading')} />;
  if (booking.isError)
    return (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void booking.refetch()} />
      </>
    );
  if (!booking.data) return <NotFound />;
  return (
    <BookingDetails
      booking={booking.data}
      onCancel={() => cancel.mutate()}
      cancelling={cancel.isPending}
      cancelFailed={cancel.isError}
      review={{
        onSubmit: (input) => review.mutate(input),
        submitting: review.isPending,
        error: review.error,
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
});
